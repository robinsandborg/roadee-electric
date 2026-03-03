import { Link, createFileRoute } from "@tanstack/react-router";
import { and, eq, useLiveQuery } from "@tanstack/react-db";
import { useEffect, useState } from "react";
import { appRoutes } from "#/lib/routes";
import { authClient } from "#/lib/auth-client";
import { joinSpaceBySlugRequest, V1ApiError } from "#/lib/v1/api-client";
import { useV1SpacesSync } from "#/hooks/use-v1-sync";
import {
  membershipsCollection,
  spacesCollection,
  upsertMembership,
  upsertSpace,
} from "#/db-collections";

export const Route = createFileRoute("/s/$spaceSlug")({
  component: SpaceRoute,
});

type Provider = "google" | "github";

function SpaceRoute() {
  const { spaceSlug } = Route.useParams();
  const normalizedSpaceSlug = spaceSlug.trim().toLowerCase();
  const { data: session, isPending } = authClient.useSession();
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "ready" | "not-found">("idle");
  const [joinError, setJoinError] = useState<string | null>(null);

  useV1SpacesSync(Boolean(session?.user));

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

  const myMembership = myMembershipRows?.[0];
  const canManageMembers = myMembership?.role === "owner" || myMembership?.role === "staff";

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
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof V1ApiError && error.status === 404) {
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
  }, [normalizedSpaceSlug, session?.user?.id]);

  if (isPending) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">Space Join</p>
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

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Space Join</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          {space?.name ?? normalizedSpaceSlug}
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          {space?.description ?? "Joining space..."}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold uppercase">
            {joinStatus === "joining" ? "joining" : "joined"}
          </span>
          {myMembership ? (
            <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold uppercase">
              role: {myMembership.role}
            </span>
          ) : null}
        </div>

        {joinError ? (
          <p className="m-0 mt-4 text-sm font-semibold text-[color:color-mix(in_srgb,var(--action-primary)_72%,var(--sea-ink))]">
            {joinError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {canManageMembers ? (
            <Link
              to={appRoutes.membersSettingsBySlug(normalizedSpaceSlug).to}
              params={appRoutes.membersSettingsBySlug(normalizedSpaceSlug).params}
              className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5"
            >
              Manage members
            </Link>
          ) : null}

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
