import { Link, createFileRoute } from "@tanstack/react-router";
import { and, eq, inArray, useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState } from "react";
import PostCommentList from "#/components/posts/PostCommentList";
import PostThreadHeader from "#/components/posts/PostThreadHeader";
import {
  categoriesCollection,
  commentsCollection,
  postTagsCollection,
  postsCollection,
  postUpvotesCollection,
  tagsCollection,
} from "#/db-collections";
import { useSpaceAccess } from "#/hooks/useSpaceAccess";
import { authClient } from "#/lib/auth-client";
import { appRoutes } from "#/lib/routes";
import { PostsApiError, richTextFromPlainText } from "#/lib/posts/api-client";

export const Route = createFileRoute("/s/$spaceSlug/p/$postId")({
  ssr: false,
  component: PostDetailRoute,
});

const NOT_FOUND_GRACE_MS = 900;

function PostDetailRoute() {
  const { spaceSlug, postId } = Route.useParams();
  const normalizedSpaceSlug = spaceSlug.trim().toLowerCase();
  const { data: session, isPending } = authClient.useSession();
  const viewerUserId = session?.user?.id ?? null;
  const isSignedIn = Boolean(viewerUserId);
  const isSessionChecking = isPending;

  const [commentText, setCommentText] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isTogglingUpvote, setIsTogglingUpvote] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [canShowSpaceNotFound, setCanShowSpaceNotFound] = useState(false);
  const [canShowPostNotFound, setCanShowPostNotFound] = useState(false);
  const {
    space,
    membership: myMembership,
    isAccessPending,
    joinStatus,
    join,
  } = useSpaceAccess({
    normalizedSpaceSlug,
    userId: viewerUserId ?? undefined,
    joinErrorMessage: "Could not verify membership for this post.",
  });

  const { data: postRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ post: postsCollection })
        .where(({ post }) => and(eq(post.id, postId), eq(post.spaceId, space.id)))
        .select(({ post }) => ({
          ...post,
        }));
    },
    [postId, space?.id],
  );
  const post = postRows?.[0];

  useEffect(() => {
    setCanShowSpaceNotFound(false);

    const timeout = setTimeout(() => {
      setCanShowSpaceNotFound(true);
    }, NOT_FOUND_GRACE_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [normalizedSpaceSlug]);

  useEffect(() => {
    setCanShowPostNotFound(false);

    const timeout = setTimeout(() => {
      setCanShowPostNotFound(true);
    }, NOT_FOUND_GRACE_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [postId, space?.id]);

  const { data: commentsForPostRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ comment: commentsCollection })
        .where(({ comment }) => and(eq(comment.postId, postId), eq(comment.spaceId, space.id)))
        .select(({ comment }) => ({
          ...comment,
        }));
    },
    [postId, space?.id],
  );

  const { data: categoryRows } = useLiveQuery(
    (query) => {
      if (!post?.categoryId) {
        return undefined;
      }

      return query
        .from({ category: categoriesCollection })
        .where(({ category }) => eq(category.id, post.categoryId))
        .select(({ category }) => ({
          ...category,
        }));
    },
    [post?.categoryId],
  );

  const { data: postTagRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ postTag: postTagsCollection })
        .where(({ postTag }) => and(eq(postTag.postId, postId), eq(postTag.spaceId, space.id)))
        .select(({ postTag }) => ({
          ...postTag,
        }));
    },
    [postId, space?.id],
  );

  const visibleTagIds = useMemo(
    () => Array.from(new Set((postTagRows ?? []).map((postTag) => postTag.tagId))),
    [postTagRows],
  );
  const visibleTagIdsKey = useMemo(() => visibleTagIds.join(","), [visibleTagIds]);

  const { data: upvoteRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ postUpvote: postUpvotesCollection })
        .where(({ postUpvote }) =>
          and(eq(postUpvote.postId, postId), eq(postUpvote.spaceId, space.id)),
        )
        .select(({ postUpvote }) => ({
          ...postUpvote,
        }));
    },
    [postId, space?.id],
  );

  const { data: tagRows } = useLiveQuery(
    (query) => {
      if (visibleTagIds.length === 0) {
        return undefined;
      }

      return query
        .from({ tag: tagsCollection })
        .where(({ tag }) => inArray(tag.id, visibleTagIds))
        .select(({ tag }) => ({
          ...tag,
        }));
    },
    [visibleTagIdsKey],
  );

  const thread = useMemo(() => {
    if (!post) {
      return null;
    }

    const categoryById = new Map((categoryRows ?? []).map((category) => [category.id, category]));
    const tagsById = new Map((tagRows ?? []).map((tag) => [tag.id, tag]));

    const tags = (postTagRows ?? [])
      .map((postTag) => tagsById.get(postTag.tagId))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));

    const upvoteCount = (upvoteRows ?? []).length;
    const hasUpvoted = Boolean(
      viewerUserId && (upvoteRows ?? []).some((upvote) => upvote.userId === viewerUserId),
    );

    const comments = [...(commentsForPostRows ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return {
      item: {
        post,
        category: post.categoryId ? (categoryById.get(post.categoryId) ?? null) : null,
        tags,
        upvoteCount,
        commentCount: comments.length,
        hasUpvoted,
      },
      comments,
    };
  }, [categoryRows, commentsForPostRows, post, postTagRows, tagRows, upvoteRows, viewerUserId]);

  const onToggleUpvote = async () => {
    if (!thread) {
      return;
    }
    if (isTogglingUpvote) {
      return;
    }

    if (!viewerUserId) {
      setActionError(
        isSessionChecking ? "Checking your session..." : "Sign in to upvote this post.",
      );
      return;
    }
    setIsTogglingUpvote(true);

    let mutationSpaceId: string | null = space?.id ?? null;
    if (!myMembership) {
      const joined = await join();
      if (!joined) {
        setActionError("Join this space before upvoting.");
        setIsTogglingUpvote(false);
        return;
      }
      mutationSpaceId = joined.space.id;
    }

    setActionError(null);

    const existing = (upvoteRows ?? []).find((row) => row.userId === viewerUserId);
    if (!mutationSpaceId) {
      setActionError("Could not update upvote.");
      setIsTogglingUpvote(false);
      return;
    }

    try {
      const tx = existing
        ? postUpvotesCollection.delete(existing.id, {
            metadata: { source: "user", action: "toggle-upvote-off" },
          })
        : postUpvotesCollection.insert(
            {
              id: `optimistic-upvote-${crypto.randomUUID()}`,
              postId,
              spaceId: mutationSpaceId,
              userId: viewerUserId,
              createdAt: new Date().toISOString(),
            },
            {
              metadata: { source: "user", action: "toggle-upvote-on" },
            },
          );

      void tx.isPersisted.promise
        .catch(() => {
          setActionError("Could not update upvote.");
        })
        .finally(() => {
          setIsTogglingUpvote(false);
        });
    } catch {
      setActionError("Could not update upvote.");
      setIsTogglingUpvote(false);
    }
  };

  const onSubmitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!viewerUserId) {
      setActionError(isSessionChecking ? "Checking your session..." : "Sign in to comment.");
      return;
    }

    const joined = await join();
    if (!joined) {
      setActionError("Join this space before commenting.");
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) {
      setActionError("Comment body is required.");
      return;
    }

    setActionError(null);
    setIsSendingComment(true);

    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();

    setCommentText("");

    try {
      const tx = commentsCollection.insert(
        {
          id: commentId,
          postId,
          spaceId: joined.space.id,
          authorId: viewerUserId,
          bodyRichText: richTextFromPlainText(trimmed),
          createdAt: now,
          updatedAt: now,
        },
        {
          metadata: {
            source: "user",
            action: "create-comment",
          },
        },
      );

      await tx.isPersisted.promise;
    } catch (unknownError) {
      if (unknownError instanceof PostsApiError && unknownError.code === "membership_required") {
        setActionError("Join the space before commenting.");
      } else {
        setActionError("Could not send comment.");
      }
    } finally {
      setIsSendingComment(false);
    }
  };

  if (joinStatus === "not-found") {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-sea-ink">
            Space not found
          </h1>
          <p className="m-0 mt-2 text-sm text-sea-ink-soft">
            No space exists for <code>{normalizedSpaceSlug}</code>.
          </p>
        </section>
      </main>
    );
  }

  const shouldShowSpaceSkeleton =
    isSessionChecking || isAccessPending || (!space && !canShowSpaceNotFound);
  if (shouldShowSpaceSkeleton) {
    return <PostThreadSkeleton message="Loading this space." />;
  }

  if (!space) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-sea-ink">
            Space not found
          </h1>
          <p className="m-0 mt-2 text-sm text-sea-ink-soft">
            No space exists for <code>{normalizedSpaceSlug}</code>.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to={appRoutes.spaceBySlug(normalizedSpaceSlug).to}
              params={appRoutes.spaceBySlug(normalizedSpaceSlug).params}
              className="inline-flex rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink no-underline"
            >
              Back to space
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const shouldShowThreadSkeleton = postRows === undefined || (!post && !canShowPostNotFound);
  if (shouldShowThreadSkeleton) {
    return <PostThreadSkeleton message="Syncing this thread." />;
  }

  if (!thread) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-sea-ink">Post not found</h1>
          <p className="m-0 mt-2 text-sm text-sea-ink-soft">
            The requested thread does not exist in this space.
          </p>
          <Link
            to={appRoutes.spaceBySlug(normalizedSpaceSlug).to}
            params={appRoutes.spaceBySlug(normalizedSpaceSlug).params}
            className="mt-4 inline-flex rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink no-underline"
          >
            Back to feed
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={appRoutes.spaceBySlug(normalizedSpaceSlug).to}
          params={appRoutes.spaceBySlug(normalizedSpaceSlug).params}
          className="inline-flex rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink no-underline"
        >
          Back to feed
        </Link>
      </div>

      <div className="mt-4 grid gap-4">
        <PostThreadHeader
          item={thread.item}
          spaceSlug={normalizedSpaceSlug}
          canEdit={Boolean(viewerUserId) && thread.item.post.authorId === viewerUserId}
          isTogglingUpvote={isTogglingUpvote}
          onToggleUpvote={() => {
            void onToggleUpvote();
          }}
        />

        <section className="rounded-2xl border border-chip-line bg-island-bg p-5">
          <h2 className="m-0 text-lg font-bold text-sea-ink">Comments</h2>
          {!isSignedIn ? (
            <p className="m-0 mt-2 text-sm text-sea-ink-soft">
              {isSessionChecking
                ? "Checking your session..."
                : "Sign in to join this space and leave comments."}
            </p>
          ) : null}

          <form className="mt-4 grid gap-3" onSubmit={onSubmitComment}>
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              rows={4}
              disabled={!isSignedIn || isSessionChecking}
              placeholder={
                isSessionChecking
                  ? "Checking your session..."
                  : isSignedIn
                    ? "Write your comment"
                    : "Sign in to comment"
              }
              className="rounded-xl border border-chip-line bg-white/80 px-4 py-3 text-sm text-sea-ink outline-none"
            />
            <button
              type="submit"
              disabled={!isSignedIn || isSessionChecking || isSendingComment}
              className="w-fit rounded-full border border-chip-line bg-sea-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {isSendingComment ? "Sending..." : "Comment"}
            </button>
          </form>

          {actionError ? (
            <p className="m-0 mt-3 text-sm font-semibold text-[color:color-mix(in_srgb,var(--action-primary)_72%,var(--sea-ink))]">
              {actionError}
            </p>
          ) : null}

          <div className="mt-4">
            <PostCommentList comments={thread.comments} />
          </div>
        </section>
      </div>
    </main>
  );
}

function PostThreadSkeleton({ message }: { message: string }) {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <div className="h-10 w-80 animate-pulse rounded-xl bg-chip-bg" />
        <p className="m-0 mt-3 text-sm text-sea-ink-soft">{message}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-chip-line bg-island-bg p-5">
        <div className="h-6 w-28 animate-pulse rounded-lg bg-chip-bg" />
        <div className="mt-4 h-8 w-3/4 animate-pulse rounded-lg bg-chip-bg" />
        <div className="mt-4 h-4 w-full animate-pulse rounded-lg bg-chip-bg" />
        <div className="mt-2 h-4 w-11/12 animate-pulse rounded-lg bg-chip-bg" />
      </section>

      <section className="mt-4 rounded-2xl border border-chip-line bg-island-bg p-5">
        <div className="h-6 w-24 animate-pulse rounded-lg bg-chip-bg" />
        <div className="mt-4 h-20 w-full animate-pulse rounded-xl bg-chip-bg" />
        <div className="mt-3 h-9 w-28 animate-pulse rounded-full bg-chip-bg" />
      </section>
    </main>
  );
}
