import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { eq, useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState } from "react";
import PostCard from "#/components/posts/PostCard";
import {
  categoriesCollection,
  commentsCollection,
  postTagsCollection,
  postsCollection,
  postUpvotesCollection,
  tagsCollection,
  type Tag,
} from "#/db-collections";
import { useSpaceAccess } from "#/hooks/useSpaceAccess";
import { authClient } from "#/lib/auth-client";
import { appRoutes } from "#/lib/routes";

export const Route = createFileRoute("/s/$spaceSlug")({
  ssr: false,
  component: SpaceRoute,
});

type Provider = "google" | "github";
const INITIAL_VISIBLE_POST_COUNT = 30;
const NOT_FOUND_GRACE_MS = 900;
const FEED_SKELETON_CARD_COUNT = 3;

function SpaceRoute() {
  const { spaceSlug } = Route.useParams();
  const normalizedSpaceSlug = spaceSlug.trim().toLowerCase();
  const location = useLocation();

  if (!isSpaceFeedPath(location.pathname, normalizedSpaceSlug)) {
    return <Outlet />;
  }

  return <SpaceFeed normalizedSpaceSlug={normalizedSpaceSlug} />;
}

function SpaceFeed({ normalizedSpaceSlug }: { normalizedSpaceSlug: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [postActionError, setPostActionError] = useState<string | null>(null);
  const [pendingUpvotePostIds, setPendingUpvotePostIds] = useState<Set<string>>(new Set());
  const [visiblePostLimit, setVisiblePostLimit] = useState(INITIAL_VISIBLE_POST_COUNT);
  const [canShowNotFound, setCanShowNotFound] = useState(false);
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
    joinErrorMessage: "Could not join this space.",
  });

  const { data: postRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ post: postsCollection })
        .where(({ post }) => eq(post.spaceId, space.id))
        .select(({ post }) => ({
          ...post,
        }));
    },
    [space?.id],
  );

  const sortedPosts = useMemo(
    () =>
      [...(postRows ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [postRows],
  );
  const visiblePosts = useMemo(
    () => sortedPosts.slice(0, visiblePostLimit),
    [sortedPosts, visiblePostLimit],
  );

  const { data: commentRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ comment: commentsCollection })
        .where(({ comment }) => eq(comment.spaceId, space.id))
        .select(({ comment }) => ({
          ...comment,
        }));
    },
    [space?.id],
  );

  const { data: upvoteRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ postUpvote: postUpvotesCollection })
        .where(({ postUpvote }) => eq(postUpvote.spaceId, space.id))
        .select(({ postUpvote }) => ({
          ...postUpvote,
        }));
    },
    [space?.id],
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

  const { data: postTagRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ postTag: postTagsCollection })
        .where(({ postTag }) => eq(postTag.spaceId, space.id))
        .select(({ postTag }) => ({
          ...postTag,
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

  const activeSpace = space;
  const activeMembership = myMembership;
  const viewerUserId = session?.user?.id ?? null;
  const isSignedIn = Boolean(viewerUserId);
  const isSessionChecking = isPending;
  const canManageMembers = activeMembership?.role === "owner" || activeMembership?.role === "staff";

  useEffect(() => {
    setVisiblePostLimit(INITIAL_VISIBLE_POST_COUNT);
  }, [normalizedSpaceSlug]);

  useEffect(() => {
    setCanShowNotFound(false);

    const timeout = setTimeout(() => {
      setCanShowNotFound(true);
    }, NOT_FOUND_GRACE_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [normalizedSpaceSlug]);

  const feed = useMemo(() => {
    if (!postRows) {
      return [];
    }

    const categoriesById = new Map((categoryRows ?? []).map((category) => [category.id, category]));
    const tagsById = new Map((tagRows ?? []).map((tag) => [tag.id, tag]));

    const postIds = new Set(visiblePosts.map((post) => post.id));
    const postTagsByPostId = new Map<string, Tag[]>();

    for (const postTag of postTagRows ?? []) {
      if (!postIds.has(postTag.postId)) {
        continue;
      }
      const tag = tagsById.get(postTag.tagId);
      if (!tag) {
        continue;
      }
      const current = postTagsByPostId.get(postTag.postId) ?? [];
      current.push(tag);
      postTagsByPostId.set(postTag.postId, current);
    }

    const commentCountByPostId = new Map<string, number>();
    for (const comment of commentRows ?? []) {
      if (!postIds.has(comment.postId)) {
        continue;
      }
      commentCountByPostId.set(comment.postId, (commentCountByPostId.get(comment.postId) ?? 0) + 1);
    }

    const upvoteCountByPostId = new Map<string, number>();
    const hasUpvotedByPostId = new Set<string>();
    for (const upvote of upvoteRows ?? []) {
      if (!postIds.has(upvote.postId)) {
        continue;
      }
      upvoteCountByPostId.set(upvote.postId, (upvoteCountByPostId.get(upvote.postId) ?? 0) + 1);
      if (viewerUserId && upvote.userId === viewerUserId) {
        hasUpvotedByPostId.add(upvote.postId);
      }
    }

    return visiblePosts.map((post) => ({
      post,
      category: post.categoryId ? (categoriesById.get(post.categoryId) ?? null) : null,
      tags: postTagsByPostId.get(post.id) ?? [],
      commentCount: commentCountByPostId.get(post.id) ?? 0,
      upvoteCount: upvoteCountByPostId.get(post.id) ?? 0,
      hasUpvoted: hasUpvotedByPostId.has(post.id),
    }));
  }, [
    categoryRows,
    commentRows,
    postRows,
    postTagRows,
    tagRows,
    upvoteRows,
    viewerUserId,
    visiblePosts,
  ]);
  const hasMorePosts = sortedPosts.length > visiblePosts.length;

  const onToggleUpvote = async (postId: string) => {
    if (pendingUpvotePostIds.has(postId)) {
      return;
    }

    if (!viewerUserId) {
      setPostActionError(
        isSessionChecking ? "Checking your session..." : "Sign in to upvote posts.",
      );
      return;
    }
    setPendingUpvotePostIds((current) => {
      const next = new Set(current);
      next.add(postId);
      return next;
    });

    let mutationSpaceId: string | null = activeSpace?.id ?? null;
    if (!activeMembership) {
      const joined = await join();
      if (!joined) {
        setPostActionError("Join this space before upvoting.");
        setPendingUpvotePostIds((current) => {
          const next = new Set(current);
          next.delete(postId);
          return next;
        });
        return;
      }
      mutationSpaceId = joined.space.id;
    }

    setPostActionError(null);

    const existing = (upvoteRows ?? []).find(
      (upvote) => upvote.postId === postId && upvote.userId === viewerUserId,
    );
    if (!mutationSpaceId) {
      setPostActionError("Could not update upvote.");
      setPendingUpvotePostIds((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
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
          setPostActionError("Could not update upvote.");
        })
        .finally(() => {
          setPendingUpvotePostIds((current) => {
            const next = new Set(current);
            next.delete(postId);
            return next;
          });
        });
    } catch {
      setPostActionError("Could not update upvote.");
      setPendingUpvotePostIds((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    }
  };

  if (joinStatus === "not-found") {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">Space Join</p>
          <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
            Space not found
          </h1>
          <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
            No space exists for slug <code>{normalizedSpaceSlug}</code>.
          </p>
          <Link
            to={appRoutes.home}
            className="mt-6 inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5"
          >
            Back to landing page
          </Link>
        </section>
      </main>
    );
  }

  const shouldShowSpaceSkeleton =
    isSessionChecking || isAccessPending || (!activeSpace && !canShowNotFound);
  if (shouldShowSpaceSkeleton) {
    return <SpaceFeedSkeleton />;
  }

  if (!activeSpace) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">Space Feed</p>
          <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
            Space not found
          </h1>
          <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
            No space exists for slug <code>{normalizedSpaceSlug}</code>.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to={appRoutes.home}
              className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5"
            >
              Back to landing page
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Space Feed</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          {activeSpace.name}
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          {activeSpace.description}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {activeMembership ? (
            <>
              <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold uppercase">
                joined
              </span>
              <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold uppercase">
                role: {activeMembership.role}
              </span>
            </>
          ) : (
            <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold uppercase">
              public read-only
            </span>
          )}
        </div>

        {joinError ? (
          <p className="m-0 mt-4 text-sm font-semibold text-[color:color-mix(in_srgb,var(--action-primary)_72%,var(--sea-ink))]">
            {joinError}
          </p>
        ) : null}

        {postActionError ? (
          <p className="m-0 mt-2 text-sm font-semibold text-[color:color-mix(in_srgb,var(--action-primary)_72%,var(--sea-ink))]">
            {postActionError}
          </p>
        ) : null}

        {!isSignedIn ? (
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            {isSessionChecking
              ? "Checking your session..."
              : "Sign in to join this space, create posts, comment, and upvote."}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {isSessionChecking ? (
            <button
              type="button"
              disabled
              className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] opacity-70"
            >
              Checking session...
            </button>
          ) : isSignedIn ? (
            <Link
              to={appRoutes.newPostBySpaceSlug(normalizedSpaceSlug).to}
              params={appRoutes.newPostBySpaceSlug(normalizedSpaceSlug).params}
              className="inline-flex rounded-full border px-4 py-2 text-sm font-semibold text-white no-underline"
            >
              New post
            </Link>
          ) : (
            <>
              <button
                type="button"
                disabled={pendingProvider !== null}
                onClick={() => {
                  void signInWithProvider("google", normalizedSpaceSlug, setPendingProvider);
                }}
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 disabled:opacity-70"
              >
                {pendingProvider === "google" ? "Connecting..." : "Continue with Google"}
              </button>
              <button
                type="button"
                disabled={pendingProvider !== null}
                onClick={() => {
                  void signInWithProvider("github", normalizedSpaceSlug, setPendingProvider);
                }}
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 disabled:opacity-70"
              >
                {pendingProvider === "github" ? "Connecting..." : "Continue with GitHub"}
              </button>
            </>
          )}
          {isSignedIn && !activeMembership ? (
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
          ) : null}
          {canManageMembers ? (
            <Link
              to={appRoutes.membersSettingsBySlug(normalizedSpaceSlug).to}
              params={appRoutes.membersSettingsBySlug(normalizedSpaceSlug).params}
              className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline"
            >
              Manage members
            </Link>
          ) : null}
          <Link
            to={appRoutes.home}
            className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline"
          >
            Back to landing page
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4">
        {!postRows ? (
          Array.from({ length: FEED_SKELETON_CARD_COUNT }).map((_, index) => (
            <FeedCardSkeleton key={`feed-skeleton-${index}`} />
          ))
        ) : feed.length === 0 ? (
          <article className="rounded-2xl border border-dashed border-[var(--chip-line)] bg-[var(--chip-bg)] p-6">
            <h2 className="m-0 text-xl font-bold text-[var(--sea-ink)]">No posts yet</h2>
            <p className="m-0 mt-2 text-sm leading-6 text-[var(--sea-ink-soft)]">
              Start the first thread for this space.
            </p>
          </article>
        ) : (
          feed.map((item) => (
            <PostCard
              key={item.post.id}
              spaceSlug={normalizedSpaceSlug}
              item={item}
              canEdit={Boolean(viewerUserId) && item.post.authorId === viewerUserId}
              isTogglingUpvote={pendingUpvotePostIds.has(item.post.id)}
              onToggleUpvote={() => {
                void onToggleUpvote(item.post.id);
              }}
            />
          ))
        )}
        {hasMorePosts ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setVisiblePostLimit((current) => current + INITIAL_VISIBLE_POST_COUNT)}
              className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5"
            >
              Load more
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function isSpaceFeedPath(pathname: string, spaceSlug: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/, "");
  return normalizedPath === `/s/${spaceSlug}`;
}

async function signInWithProvider(
  provider: Provider,
  spaceSlug: string,
  setPendingProvider: (provider: Provider | null) => void,
) {
  setPendingProvider(provider);

  try {
    await authClient.signIn.social({
      provider,
      callbackURL: `/s/${spaceSlug}`,
    });
  } finally {
    setPendingProvider(null);
  }
}

function SpaceFeedSkeleton() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Space Feed</p>
        <div className="h-11 w-72 animate-pulse rounded-xl bg-[var(--chip-bg)]" />
        <div className="mt-3 h-5 w-full max-w-3xl animate-pulse rounded-lg bg-[var(--chip-bg)]" />
        <div className="mt-6 h-8 w-40 animate-pulse rounded-full bg-[var(--chip-bg)]" />
      </section>

      <section className="mt-6 grid gap-4">
        {Array.from({ length: FEED_SKELETON_CARD_COUNT }).map((_, index) => (
          <FeedCardSkeleton key={`page-skeleton-${index}`} />
        ))}
      </section>
    </main>
  );
}

function FeedCardSkeleton() {
  return (
    <article className="rounded-2xl border border-[var(--chip-line)] bg-[var(--island-bg)] p-5 shadow-[var(--island-shadow)]">
      <div className="h-5 w-24 animate-pulse rounded-full bg-[var(--chip-bg)]" />
      <div className="mt-3 h-7 w-3/4 animate-pulse rounded-lg bg-[var(--chip-bg)]" />
      <div className="mt-3 h-4 w-full animate-pulse rounded-lg bg-[var(--chip-bg)]" />
      <div className="mt-2 h-4 w-5/6 animate-pulse rounded-lg bg-[var(--chip-bg)]" />
      <div className="mt-5 flex gap-3">
        <div className="h-7 w-24 animate-pulse rounded-full bg-[var(--chip-bg)]" />
        <div className="h-7 w-28 animate-pulse rounded-full bg-[var(--chip-bg)]" />
      </div>
    </article>
  );
}
