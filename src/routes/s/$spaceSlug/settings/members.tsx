import { Link, createFileRoute } from "@tanstack/react-router";
import { and, eq, useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState } from "react";
import { appRoutes } from "#/lib/routes";
import { authClient } from "#/lib/auth-client";
import {
  fetchMembersForSpace,
  promoteMemberToStaffRequest,
  SpacesApiError,
} from "#/lib/spaces/api-client";
import { useSpacesSync } from "#/hooks/use-spaces-sync";
import {
  membershipsCollection,
  spacesCollection,
  upsertMembership,
  upsertSpace,
} from "#/db-collections";

export const Route = createFileRoute("/s/$spaceSlug/settings/members")({
  component: MembersSettingsRoute,
});

function MembersSettingsRoute() {
  const { spaceSlug } = Route.useParams();
  const normalizedSpaceSlug = spaceSlug.trim().toLowerCase();
  const { data: session, isPending } = authClient.useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);

  useSpacesSync(Boolean(session?.user));

  const { data: spaces } = useLiveQuery(
    (query) =>
      query
        .from({ space: spacesCollection })
        .where(({ space }) => eq(space.slug, normalizedSpaceSlug))
        .select(({ space }) => ({
          ...space,
        })),
    [normalizedSpaceSlug],
  );

  const space = spaces?.[0];

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
  const myMembership = myMembershipRows?.[0];

  const { data: memberRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ membership: membershipsCollection })
        .where(({ membership }) => eq(membership.spaceId, space.id))
        .select(({ membership }) => ({
          ...membership,
        }));
    },
    [space?.id],
  );

  const sortedMembers = useMemo(
    () =>
      [...(memberRows ?? [])].sort((a, b) => {
        if (a.role === b.role) {
          return a.userId.localeCompare(b.userId);
        }
        return roleRank(a.role) - roleRank(b.role);
      }),
    [memberRows],
  );

  const canPromote = myMembership?.role === "owner" || myMembership?.role === "staff";

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const result = await fetchMembersForSpace(normalizedSpaceSlug);
        if (cancelled) {
          return;
        }

        upsertSpace(result.space);
        for (const membership of result.memberships) {
          upsertMembership(membership);
        }

        setIsLoading(false);
      } catch (unknownError) {
        if (cancelled) {
          return;
        }

        if (unknownError instanceof SpacesApiError && unknownError.status === 403) {
          setError("You do not have access to this members page.");
        } else if (unknownError instanceof SpacesApiError && unknownError.status === 404) {
          setError("Space not found.");
        } else {
          setError("Could not load members.");
        }
        setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [normalizedSpaceSlug, session?.user?.id]);

  if (isPending) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">Members</p>
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
          <p className="island-kicker mb-2">Members</p>
          <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
            Sign in required
          </h1>
          <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
            Authenticate to manage this space.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Members</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          {space?.name ?? normalizedSpaceSlug}
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          Promote colleagues to staff.
        </p>

        {isLoading ? <p className="mt-4 text-sm">Loading members...</p> : null}
        {error ? (
          <p className="mt-4 text-sm font-semibold text-[color:color-mix(in_srgb,var(--action-primary)_72%,var(--sea-ink))]">
            {error}
          </p>
        ) : null}

        {!error ? (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--chip-line)]">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-[var(--chip-bg)] text-left text-xs uppercase">
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((member) => {
                  const canPromoteMember =
                    canPromote && member.role === "user" && member.userId !== session.user.id;

                  return (
                    <tr key={member.id} className="border-t border-[var(--chip-line)] text-sm">
                      <td className="px-4 py-3">
                        <code>{member.userId}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2 py-1 text-xs font-semibold uppercase">
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canPromoteMember ? (
                          <button
                            type="button"
                            disabled={promotingUserId === member.userId}
                            onClick={() => {
                              void promoteMember(
                                member.userId,
                                normalizedSpaceSlug,
                                setPromotingUserId,
                                setError,
                              );
                            }}
                            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold text-[var(--sea-ink)]"
                          >
                            {promotingUserId === member.userId
                              ? "Promoting..."
                              : "Promote to staff"}
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--sea-ink-soft)]">No action</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={appRoutes.spaceBySlug(normalizedSpaceSlug).to}
            params={appRoutes.spaceBySlug(normalizedSpaceSlug).params}
            className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5"
          >
            Back to space
          </Link>
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

async function promoteMember(
  targetUserId: string,
  spaceSlug: string,
  setPromotingUserId: (value: string | null) => void,
  setError: (value: string | null) => void,
) {
  setPromotingUserId(targetUserId);
  setError(null);
  try {
    const result = await promoteMemberToStaffRequest({
      spaceSlug,
      targetUserId,
    });
    upsertMembership(result.membership);
  } catch (unknownError) {
    if (unknownError instanceof SpacesApiError && unknownError.status === 403) {
      setError("Only owner or staff can promote members.");
    } else {
      setError("Could not promote member.");
    }
  } finally {
    setPromotingUserId(null);
  }
}

function roleRank(role: "owner" | "staff" | "user"): number {
  switch (role) {
    case "owner":
      return 0;
    case "staff":
      return 1;
    case "user":
      return 2;
  }
}
