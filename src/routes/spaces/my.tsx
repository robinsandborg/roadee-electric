import { Link, createFileRoute } from "@tanstack/react-router";
import { eq, inArray, useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import { membershipsCollection, spacesCollection } from "#/db-collections";
import { requireSessionBeforeLoad } from "#/lib/auth-guard";
import { authClient } from "#/lib/auth-client";
import { appRoutes } from "#/lib/routes";

export const Route = createFileRoute("/spaces/my")({
  ssr: false,
  beforeLoad: async () => {
    await requireSessionBeforeLoad("/");
  },
  component: MySpacesRoute,
});

type JoinedSpace = {
  id: string;
  slug: string;
  name: string;
  description: string;
  role: "owner" | "staff" | "user";
};

function MySpacesRoute() {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id;

  const { data: myMembershipRows } = useLiveQuery(
    (query) => {
      if (!userId) {
        return undefined;
      }

      return query
        .from({ membership: membershipsCollection })
        .where(({ membership }) => eq(membership.userId, userId))
        .select(({ membership }) => ({
          ...membership,
        }));
    },
    [userId],
  );

  const joinedSpaceIds = useMemo(
    () =>
      Array.from(
        new Set(
          (myMembershipRows ?? []).map((membership) => membership.spaceId),
        ),
      ),
    [myMembershipRows],
  );
  const joinedSpaceIdsKey = useMemo(
    () => joinedSpaceIds.join(","),
    [joinedSpaceIds],
  );

  const { data: joinedSpaceRows } = useLiveQuery(
    (query) => {
      if (joinedSpaceIds.length === 0) {
        return undefined;
      }

      return query
        .from({ space: spacesCollection })
        .where(({ space }) => inArray(space.id, joinedSpaceIds))
        .select(({ space }) => ({
          ...space,
        }));
    },
    [joinedSpaceIdsKey],
  );

  const joinedSpaces = useMemo<JoinedSpace[]>(() => {
    const membershipBySpaceId = new Map(
      (myMembershipRows ?? []).map((membership) => [
        membership.spaceId,
        membership,
      ]),
    );

    return [...(joinedSpaceRows ?? [])]
      .map((space) => {
        const membership = membershipBySpaceId.get(space.id);
        if (!membership) {
          return null;
        }

        return {
          id: space.id,
          slug: space.slug,
          name: space.name,
          description: space.description,
          role: membership.role,
        };
      })
      .filter((entry): entry is JoinedSpace => entry !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [joinedSpaceRows, myMembershipRows]);

  const isLoading =
    Boolean(userId) &&
    (myMembershipRows === undefined ||
      (joinedSpaceIds.length > 0 && joinedSpaceRows === undefined));

  if (isPending) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">My Spaces</p>
          <h1 className="display-title mb-3 text-4xl font-bold text-sea-ink sm:text-5xl">
            Loading your spaces...
          </h1>
        </section>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">My Spaces</p>
          <h1 className="display-title mb-3 text-4xl font-bold text-sea-ink sm:text-5xl">
            Sign in required
          </h1>
          <p className="m-0 max-w-3xl text-base leading-8 text-sea-ink-soft">
            Sign in to view the spaces you have joined.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">My Spaces</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-sea-ink sm:text-5xl">
          Spaces you have joined
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-sea-ink-soft">
          Jump back into your product communities and keep discussions moving.
        </p>

        {isLoading ? (
          <p className="mt-6 text-sm text-sea-ink-soft">Loading spaces...</p>
        ) : null}

        {!isLoading && joinedSpaces.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-chip-line bg-chip-bg p-5">
            <p className="m-0 text-sm font-semibold text-sea-ink">
              You have not joined any spaces yet.
            </p>
            <p className="m-0 mt-1 text-sm text-sea-ink-soft">
              Create a new space or join one from the landing page.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to={appRoutes.createSpace}
                className="inline-flex rounded-full border border-chip-line bg-sea-ink px-4 py-2 text-sm font-semibold text-white no-underline transition hover:-translate-y-0.5"
              >
                Create a space
              </Link>
              <Link
                to={appRoutes.home}
                className="inline-flex rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink no-underline transition hover:-translate-y-0.5"
              >
                Go to landing page
              </Link>
            </div>
          </div>
        ) : null}

        {!isLoading && joinedSpaces.length > 0 ? (
          <div className="mt-6 grid gap-4">
            {joinedSpaces.map((joinedSpace) => (
              <article
                key={joinedSpace.id}
                className="rounded-2xl border border-chip-line bg-chip-bg p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="m-0 text-xl font-bold text-sea-ink">
                    {joinedSpace.name}
                  </h2>
                  <span className="rounded-full border border-chip-line bg-white/55 px-3 py-1 text-xs font-semibold uppercase text-sea-ink-soft">
                    {formatRole(joinedSpace.role)}
                  </span>
                </div>

                <p className="m-0 mt-2 text-sm leading-6 text-sea-ink-soft">
                  {joinedSpace.description || "No description yet."}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    to={appRoutes.spaceBySlug(joinedSpace.slug).to}
                    params={appRoutes.spaceBySlug(joinedSpace.slug).params}
                    className="inline-flex rounded-full bg-copy-base px-4 py-2 text-sm font-semibold text-offwhite no-underline transition hover:-translate-y-0.5"
                  >
                    Open space
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function formatRole(role: "owner" | "staff" | "user"): string {
  if (role === "owner") {
    return "Owner";
  }
  if (role === "staff") {
    return "Staff";
  }
  return "Member";
}
