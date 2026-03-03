import { Link, createFileRoute } from "@tanstack/react-router";
import { and, eq, useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState } from "react";
import PostCommentList from "#/components/posts/PostCommentList";
import PostThreadHeader from "#/components/posts/PostThreadHeader";
import {
  categoriesCollection,
  commentsCollection,
  membershipsCollection,
  postTagsCollection,
  postsCollection,
  postUpvotesCollection,
  removeComment,
  removePostUpvote,
  spacesCollection,
  tagsCollection,
  upsertComment,
  upsertMembership,
  upsertPostUpvote,
  upsertSpace,
} from "#/db-collections";
import { useSpacesSync } from "#/hooks/use-spaces-sync";
import { usePostsSync } from "#/hooks/use-posts-sync";
import { authClient } from "#/lib/auth-client";
import { appRoutes } from "#/lib/routes";
import {
  createCommentRequest,
  richTextFromPlainText,
  toggleUpvoteRequest,
  PostsApiError,
} from "#/lib/posts/api-client";
import { reconcileUpvotesForPostUser } from "#/lib/posts/local-collections";
import { joinSpaceBySlugRequest, SpacesApiError } from "#/lib/spaces/api-client";

export const Route = createFileRoute("/s/$spaceSlug/p/$postId")({
  component: PostDetailRoute,
});

function PostDetailRoute() {
  const { spaceSlug, postId } = Route.useParams();
  const normalizedSpaceSlug = spaceSlug.trim().toLowerCase();
  const { data: session, isPending } = authClient.useSession();

  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "ready" | "not-found">("idle");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isTogglingUpvote, setIsTogglingUpvote] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useSpacesSync(Boolean(session?.user));
  usePostsSync(Boolean(session?.user), normalizedSpaceSlug);

  const { data: spaceRows } = useLiveQuery(
    (query) =>
      query
        .from({ space: spacesCollection })
        .where(({ space }) => eq(space.slug, normalizedSpaceSlug))
        .select(({ space }) => ({
          ...space,
        })),
    [normalizedSpaceSlug],
  );
  const space = spaceRows?.[0];

  const { data: myMembershipRows } = useLiveQuery(
    (query) => {
      if (!space?.id || !session?.user?.id) {
        return undefined;
      }

      return query
        .from({ membership: membershipsCollection })
        .where(({ membership }) =>
          and(eq(membership.spaceId, space.id), eq(membership.userId, session.user.id)),
        )
        .select(({ membership }) => ({
          ...membership,
        }));
    },
    [space?.id, session?.user?.id],
  );

  const { data: postRows } = useLiveQuery(
    (query) =>
      query
        .from({ post: postsCollection })
        .where(({ post }) => eq(post.id, postId))
        .select(({ post }) => ({
          ...post,
        })),
    [postId],
  );

  const post = postRows?.find((row) => (space?.id ? row.spaceId === space.id : true));

  const { data: commentsForPostRows } = useLiveQuery(
    (query) =>
      query
        .from({ comment: commentsCollection })
        .where(({ comment }) => eq(comment.postId, postId))
        .select(({ comment }) => ({
          ...comment,
        })),
    [postId],
  );

  const { data: categoryRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ category: categoriesCollection })
        .where(({ category }) => eq(category.spaceId, space.id))
        .select(({ category }) => ({
          ...category,
        }));
    },
    [space?.id],
  );

  const { data: tagRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ tag: tagsCollection })
        .where(({ tag }) => eq(tag.spaceId, space.id))
        .select(({ tag }) => ({
          ...tag,
        }));
    },
    [space?.id],
  );

  const { data: postTagRows } = useLiveQuery(
    (query) =>
      query
        .from({ postTag: postTagsCollection })
        .where(({ postTag }) => eq(postTag.postId, postId))
        .select(({ postTag }) => ({
          ...postTag,
        })),
    [postId],
  );

  const { data: upvoteRows } = useLiveQuery(
    (query) =>
      query
        .from({ postUpvote: postUpvotesCollection })
        .where(({ postUpvote }) => eq(postUpvote.postId, postId))
        .select(({ postUpvote }) => ({
          ...postUpvote,
        })),
    [postId],
  );

  const myMembership = myMembershipRows?.[0];

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

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    let cancelled = false;
    setJoinStatus("joining");
    setJoinError(null);

    const run = async () => {
      try {
        const result = await joinSpaceBySlugRequest({
          membershipId: crypto.randomUUID(),
          spaceSlug: normalizedSpaceSlug,
        });

        if (cancelled) {
          return;
        }

        upsertSpace(result.space);
        upsertMembership(result.membership);
        setJoinStatus("ready");
      } catch (unknownError) {
        if (cancelled) {
          return;
        }

        if (unknownError instanceof SpacesApiError && unknownError.status === 404) {
          setJoinStatus("not-found");
          return;
        }

        setJoinError("Could not verify membership for this post.");
        setJoinStatus("idle");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [normalizedSpaceSlug, session?.user?.id]);

  const onToggleUpvote = async () => {
    if (!session?.user?.id || !space?.id || !thread) {
      return;
    }

    setActionError(null);
    setIsTogglingUpvote(true);

    const existing = (upvoteRows ?? []).filter((row) => row.userId === session.user.id);

    let optimistic: { id: string } | null = null;

    for (const row of existing) {
      removePostUpvote(row.id);
    }

    if (existing.length === 0) {
      optimistic = { id: `optimistic-upvote-${crypto.randomUUID()}` };
      upsertPostUpvote({
        id: optimistic.id,
        postId,
        spaceId: space.id,
        userId: session.user.id,
        createdAt: new Date().toISOString(),
      });
    }

    try {
      const result = await toggleUpvoteRequest({ postId });
      reconcileUpvotesForPostUser(postId, session.user.id, result.upvote);
    } catch {
      if (optimistic) {
        removePostUpvote(optimistic.id);
      }

      for (const row of existing) {
        upsertPostUpvote(row);
      }

      setActionError("Could not update upvote.");
    } finally {
      setIsTogglingUpvote(false);
    }
  };

  const onSubmitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.user?.id || !space?.id) {
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) {
      setActionError("Comment body is required.");
      return;
    }

    setActionError(null);
    setIsSendingComment(true);

    const optimisticCommentId = crypto.randomUUID();
    const now = new Date().toISOString();

    upsertComment({
      id: optimisticCommentId,
      postId,
      spaceId: space.id,
      authorId: session.user.id,
      bodyRichText: richTextFromPlainText(trimmed),
      createdAt: now,
      updatedAt: now,
    });

    setCommentText("");

    try {
      const result = await createCommentRequest({
        id: optimisticCommentId,
        postId,
        bodyRichText: richTextFromPlainText(trimmed),
      });
      upsertComment(result.comment);
    } catch (unknownError) {
      removeComment(optimisticCommentId);

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

  if (!space || !myMembership || joinStatus !== "ready") {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">
            Preparing thread...
          </h1>
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            {joinError ?? "Checking membership and loading post data."}
          </p>
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
