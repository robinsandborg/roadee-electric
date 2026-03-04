import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { and, eq, useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState } from "react";
import PostCard from "#/components/posts/PostCard";
import {
  categoriesCollection,
  commentsCollection,
  membershipsCollection,
  postTagsCollection,
  postsCollection,
  postUpvotesCollection,
  spacesCollection,
  tagsCollection,
  upsertMembership,
  upsertSpace,
  type Membership,
  type Space,
  type Tag,
} from "#/db-collections";
import { authClient } from "#/lib/auth-client";
import { appRoutes } from "#/lib/routes";
import { joinSpaceBySlugRequest, SpacesApiError } from "#/lib/spaces/api-client";

export const Route = createFileRoute("/s/$spaceSlug")({
  component: SpaceRoute,
});

type Provider = "google" | "github";

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
  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "ready" | "not-found">("idle");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [postActionError, setPostActionError] = useState<string | null>(null);
  const [togglingPostId, setTogglingPostId] = useState<string | null>(null);
  const [joinedSpace, setJoinedSpace] = useState<Space | null>(null);
  const [joinedMembership, setJoinedMembership] = useState<Membership | null>(null);

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
      if (!space?.id || !session?.user.id) {
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
    [space?.id, session?.user.id],
  );

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

  const myMembership = myMembershipRows?.[0];
  const activeSpace = space ?? joinedSpace;
  const activeMembership = myMembership ?? joinedMembership;
  const canManageMembers = activeMembership?.role === "owner" || activeMembership?.role === "staff";

  const feed = useMemo(() => {
    if (!session?.user || !postRows) {
      return [];
    }

    const categoriesById = new Map((categoryRows ?? []).map((category) => [category.id, category]));
    const tagsById = new Map((tagRows ?? []).map((tag) => [tag.id, tag]));

    const postIds = new Set(postRows.map((post) => post.id));
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
      commentCountByPostId.set(comment.postId, (commentCountByPostId.get(comment.postId) ?? 0) + 1);
    }

    const upvoteCountByPostId = new Map<string, number>();
    const hasUpvotedByPostId = new Set<string>();
    for (const upvote of upvoteRows ?? []) {
      upvoteCountByPostId.set(upvote.postId, (upvoteCountByPostId.get(upvote.postId) ?? 0) + 1);
      if (upvote.userId === session.user.id) {
        hasUpvotedByPostId.add(upvote.postId);
      }
    }

    return [...postRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((post) => ({
        post,
        category: post.categoryId ? (categoriesById.get(post.categoryId) ?? null) : null,
        tags: postTagsByPostId.get(post.id) ?? [],
        commentCount: commentCountByPostId.get(post.id) ?? 0,
        upvoteCount: upvoteCountByPostId.get(post.id) ?? 0,
        hasUpvoted: hasUpvotedByPostId.has(post.id),
      }));
  }, [categoryRows, commentRows, postRows, postTagRows, session?.user, tagRows, upvoteRows]);

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    if (activeSpace && activeMembership) {
      setJoinStatus("ready");
      setJoinError(null);
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
        setJoinedSpace(result.space);
        setJoinedMembership(result.membership);
        setJoinStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof SpacesApiError && error.status === 404) {
          setJoinStatus("not-found");
          return;
        }

        setJoinError("Could not join this space.");
        setJoinStatus("idle");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeMembership, activeSpace, normalizedSpaceSlug, session?.user?.id]);

  const onToggleUpvote = async (postId: string) => {
    if (!session?.user?.id || !space?.id) {
      return;
    }

    setPostActionError(null);
    setTogglingPostId(postId);

    const existingRows = (upvoteRows ?? []).filter(
      (upvote) => upvote.postId === postId && upvote.userId === session.user.id,
    );
    const existing = existingRows[0];

    try {
      const tx = existing
        ? postUpvotesCollection.delete(existing.id, {
            metadata: { source: "user", action: "toggle-upvote-off" },
          })
        : postUpvotesCollection.insert(
            {
              id: `optimistic-upvote-${crypto.randomUUID()}`,
              postId,
              spaceId: space.id,
              userId: session.user.id,
              createdAt: new Date().toISOString(),
            },
            {
              metadata: { source: "user", action: "toggle-upvote-on" },
            },
          );

      await tx.isPersisted.promise;
    } catch {
      setPostActionError("Could not update upvote.");
    } finally {
      setTogglingPostId(null);
    }
  };

  if (isPending) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">Space Feed</p>
          <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
            Loading...
          </h1>
        </section>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">Space Join</p>
          <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
            Sign in to join {normalizedSpaceSlug}
          </h1>
          <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
            You need to authenticate before we can add your membership.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
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
          </div>
        </section>
      </main>
    );
  }

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

  if (!activeSpace || !activeMembership || joinStatus !== "ready") {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">Space Join</p>
          <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
            Joining {normalizedSpaceSlug}...
          </h1>
          <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
            {joinError ?? "Checking membership and loading space data."}
          </p>
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
          <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold uppercase">
            joined
          </span>
          <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold uppercase">
            role: {activeMembership.role}
          </span>
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

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={appRoutes.newPostBySpaceSlug(normalizedSpaceSlug).to}
            params={appRoutes.newPostBySpaceSlug(normalizedSpaceSlug).params}
            className="inline-flex rounded-full border px-4 py-2 text-sm font-semibold text-white no-underline"
          >
            New post
          </Link>
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
        {feed.length === 0 ? (
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
              canEdit={item.post.authorId === session.user.id}
              isTogglingUpvote={togglingPostId === item.post.id}
              onToggleUpvote={() => {
                void onToggleUpvote(item.post.id);
              }}
            />
          ))
        )}
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
