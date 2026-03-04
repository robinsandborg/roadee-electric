import { and, eq, useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState } from "react";
import {
  membershipsCollection,
  spacesCollection,
  type Membership,
  type Space,
} from "#/db-collections";
import { joinSpaceBySlugRequest, SpacesApiError } from "#/lib/spaces/api-client";

type JoinStatus = "idle" | "joining" | "ready" | "not-found";

type UseSpaceAccessInput = {
  normalizedSpaceSlug: string;
  userId?: string;
  joinErrorMessage: string;
};

export function useSpaceAccess(input: UseSpaceAccessInput) {
  const [joinStatus, setJoinStatus] = useState<JoinStatus>("idle");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinedSpace, setJoinedSpace] = useState<Space | null>(null);
  const [joinedMembership, setJoinedMembership] = useState<Membership | null>(null);

  useEffect(() => {
    setJoinStatus("idle");
    setJoinError(null);
    setJoinedSpace(null);
    setJoinedMembership(null);
  }, [input.normalizedSpaceSlug, input.userId]);

  const { data: spaceRows } = useLiveQuery(
    (query) => {
      if (!input.userId) {
        return undefined;
      }

      return query
        .from({ space: spacesCollection })
        .where(({ space }) => eq(space.slug, input.normalizedSpaceSlug))
        .select(({ space }) => ({
          ...space,
        }));
    },
    [input.normalizedSpaceSlug, input.userId],
  );
  const fallbackSpace = useMemo(() => {
    if (!joinedSpace) {
      return null;
    }
    return joinedSpace.slug === input.normalizedSpaceSlug ? joinedSpace : null;
  }, [input.normalizedSpaceSlug, joinedSpace]);

  const space = spaceRows?.[0] ?? fallbackSpace;

  const { data: myMembershipRows } = useLiveQuery(
    (query) => {
      if (!space?.id || !input.userId) {
        return undefined;
      }

      return query
        .from({ membership: membershipsCollection })
        .where(({ membership }) =>
          and(eq(membership.spaceId, space.id), eq(membership.userId, input.userId)),
        )
        .select(({ membership }) => ({
          ...membership,
        }));
    },
    [space?.id, input.userId],
  );
  const fallbackMembership = useMemo(() => {
    if (!joinedMembership || !input.userId || !space?.id) {
      return null;
    }
    if (joinedMembership.userId !== input.userId) {
      return null;
    }
    if (joinedMembership.spaceId !== space.id) {
      return null;
    }
    return joinedMembership;
  }, [input.userId, joinedMembership, space?.id]);

  const membership = myMembershipRows?.[0] ?? fallbackMembership;
  const isAccessPending =
    Boolean(input.userId) &&
    ((!fallbackSpace && spaceRows === undefined) ||
      (Boolean(space?.id) && !fallbackMembership && myMembershipRows === undefined));

  const join = async (): Promise<{ space: Space; membership: Membership } | null> => {
    if (!input.userId) {
      return null;
    }

    if (space && membership) {
      return { space, membership };
    }

    setJoinStatus("joining");
    setJoinError(null);

    try {
      const result = await joinSpaceBySlugRequest({
        membershipId: crypto.randomUUID(),
        spaceSlug: input.normalizedSpaceSlug,
      });

      setJoinedSpace(result.space);
      setJoinedMembership(result.membership);
      setJoinStatus("ready");

      return {
        space: result.space,
        membership: result.membership,
      };
    } catch (error) {
      if (error instanceof SpacesApiError && error.status === 404) {
        setJoinStatus("not-found");
        return null;
      }

      setJoinError(input.joinErrorMessage);
      setJoinStatus("idle");
      return null;
    }
  };

  return {
    space,
    membership,
    isAccessPending,
    joinStatus,
    joinError,
    join,
  };
}
