import { Link, createFileRoute } from "@tanstack/react-router";
import { and, eq, inArray, useLiveQuery } from "@tanstack/react-db";
import { useMemo, useState } from "react";
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

function PostDetailRoute() {
  const { spaceSlug, postId } = Route.useParams();
  const normalizedSpaceSlug = spaceSlug.trim().toLowerCase();
  const { data: session, isPending } = authClient.useSession();

  const [commentText, setCommentText] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isTogglingUpvote, setIsTogglingUpvote] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    space,
    membership: myMembership,
    isAccessPending,
    joinStatus,
    joinError,
    join,
  } = useSpaceAccess({
    normalizedSpaceSlug,
    userId: session?.user.id,
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
    if (!post || !session?.user) {
      return null;
    }

    const categoryById = new Map((categoryRows ?? []).map((category) => [category.id, category]));
    const tagsById = new Map((tagRows ?? []).map((tag) => [tag.id, tag]));

    const tags = (postTagRows ?? [])
      .map((postTag) => tagsById.get(postTag.tagId))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));

    const upvoteCount = (upvoteRows ?? []).length;
    const hasUpvoted = (upvoteRows ?? []).some((upvote) => upvote.userId === session.user.id);

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
  }, [categoryRows, commentsForPostRows, post, postTagRows, session?.user, tagRows, upvoteRows]);

  const onToggleUpvote = async () => {
    if (!session?.user?.id || !thread) {
      return;
    }

    const joined = await join();
    if (!joined) {
      setActionError("Join this space before upvoting.");
      return;
    }

    setActionError(null);
    setIsTogglingUpvote(true);

    const existing = (upvoteRows ?? []).find((row) => row.userId === session.user.id);

    try {
      const tx = existing
        ? postUpvotesCollection.delete(existing.id, {
            metadata: { source: "user", action: "toggle-upvote-off" },
          })
        : postUpvotesCollection.insert(
            {
              id: `optimistic-upvote-${crypto.randomUUID()}`,
              postId,
              spaceId: joined.space.id,
              userId: session.user.id,
              createdAt: new Date().toISOString(),
            },
            {
              metadata: { source: "user", action: "toggle-upvote-on" },
            },
          );

      await tx.isPersisted.promise;
    } catch {
      setActionError("Could not update upvote.");
    } finally {
      setIsTogglingUpvote(false);
    }
  };

  const onSubmitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.user?.id) {
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
          authorId: session.user.id,
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

  if (isPending) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">Loading...</h1>
        </section>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">
            Sign in required
          </h1>
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            You need to authenticate before viewing this thread.
          </p>
        </section>
      </main>
    );
  }

  if (joinStatus === "not-found") {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">
            Space not found
          </h1>
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            No space exists for <code>{normalizedSpaceSlug}</code>.
          </p>
        </section>
      </main>
    );
  }

  if (isAccessPending && (!space || !myMembership)) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">Loading...</h1>
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            Verifying your membership in this space.
          </p>
        </section>
      </main>
    );
  }

  if (!space || !myMembership) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">Join required</h1>
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            {joinError ?? "Join this space to view and interact with this thread."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={joinStatus === "joining"}
              onClick={() => {
                void join();
              }}
              className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 disabled:opacity-70"
            >
              {joinStatus === "joining" ? "Joining..." : "Join space"}
            </button>
            <Link
              to={appRoutes.spaceBySlug(normalizedSpaceSlug).to}
              params={appRoutes.spaceBySlug(normalizedSpaceSlug).params}
              className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline"
            >
              Back to space
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!thread) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">Post not found</h1>
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            The requested thread does not exist in this space.
          </p>
          <Link
            to={appRoutes.spaceBySlug(normalizedSpaceSlug).to}
            params={appRoutes.spaceBySlug(normalizedSpaceSlug).params}
            className="mt-4 inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline"
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
          className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline"
        >
          Back to feed
        </Link>
      </div>

      <div className="mt-4 grid gap-4">
        <PostThreadHeader
          item={thread.item}
          spaceSlug={normalizedSpaceSlug}
          canEdit={thread.item.post.authorId === session.user.id}
          isTogglingUpvote={isTogglingUpvote}
          onToggleUpvote={() => {
            void onToggleUpvote();
          }}
        />

        <section className="rounded-2xl border border-[var(--chip-line)] bg-[var(--island-bg)] p-5">
          <h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">Comments</h2>

          <form className="mt-4 grid gap-3" onSubmit={onSubmitComment}>
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              rows={4}
              placeholder="Write your comment"
              className="rounded-xl border border-[var(--chip-line)] bg-white/80 px-4 py-3 text-sm text-[var(--sea-ink)] outline-none"
            />
            <button
              type="submit"
              disabled={isSendingComment}
              className="w-fit rounded-full border border-[var(--chip-line)] bg-[var(--sea-ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
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
