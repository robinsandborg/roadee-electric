import { describe, expect, it } from "vitest";
import {
  V1ServiceError,
  createSpace,
  joinSpaceBySlug,
  promoteMemberToStaff,
} from "#/lib/v1/service";
import type { V1State } from "#/lib/v1/types";

function makeState(): V1State {
  return {
    spaces: [],
    memberships: [],
  };
}

describe("createSpace", () => {
  it("rejects slug conflicts", () => {
    const state = makeState();
    createSpace(state, {
      id: "space-1",
      ownerMembershipId: "membership-1",
      name: "Acme",
      slug: "acme",
      description: "Acme space",
      createdBy: "user-1",
      now: "2026-03-03T11:00:00.000Z",
    });

    expect(() =>
      createSpace(state, {
        id: "space-2",
        ownerMembershipId: "membership-2",
        name: "Acme duplicate",
        slug: "acme",
        description: "Duplicate space",
        createdBy: "user-2",
      }),
    ).toThrowError(V1ServiceError);

    try {
      createSpace(state, {
        id: "space-3",
        ownerMembershipId: "membership-3",
        name: "Acme duplicate",
        slug: "acme",
        description: "Duplicate space",
        createdBy: "user-3",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(V1ServiceError);
      expect((error as V1ServiceError).code).toBe("slug_conflict");
    }
  });
});

describe("joinSpaceBySlug", () => {
  it("is idempotent for repeated joins", () => {
    const state = makeState();
    const created = createSpace(state, {
      id: "space-1",
      ownerMembershipId: "membership-owner",
      name: "Acme",
      slug: "acme",
      description: "Acme space",
      createdBy: "owner-user",
      now: "2026-03-03T11:00:00.000Z",
    });
    expect(created.space.slug).toBe("acme");

    const firstJoin = joinSpaceBySlug(state, {
      membershipId: "membership-join",
      spaceSlug: "acme",
      userId: "user-2",
      now: "2026-03-03T11:00:01.000Z",
    });
    const secondJoin = joinSpaceBySlug(state, {
      membershipId: "membership-join-new",
      spaceSlug: "acme",
      userId: "user-2",
      now: "2026-03-03T11:00:02.000Z",
    });

    expect(firstJoin.created).toBe(true);
    expect(secondJoin.created).toBe(false);
    expect(firstJoin.membership.id).toBe(secondJoin.membership.id);

    const userMemberships = state.memberships.filter(
      (membership) => membership.spaceId === firstJoin.space.id && membership.userId === "user-2",
    );
    expect(userMemberships).toHaveLength(1);
  });
});

describe("promoteMemberToStaff", () => {
  it("blocks non-staff from promoting members", () => {
    const state = makeState();
    const created = createSpace(state, {
      id: "space-1",
      ownerMembershipId: "membership-owner",
      name: "Acme",
      slug: "acme",
      description: "Acme space",
      createdBy: "owner-user",
      now: "2026-03-03T11:00:00.000Z",
    });

    joinSpaceBySlug(state, {
      membershipId: "membership-user-1",
      spaceSlug: created.space.slug,
      userId: "user-1",
    });
    joinSpaceBySlug(state, {
      membershipId: "membership-user-2",
      spaceSlug: created.space.slug,
      userId: "user-2",
    });

    expect(() =>
      promoteMemberToStaff(state, {
        spaceSlug: created.space.slug,
        actorUserId: "user-1",
        targetUserId: "user-2",
      }),
    ).toThrowError(V1ServiceError);

    try {
      promoteMemberToStaff(state, {
        spaceSlug: created.space.slug,
        actorUserId: "user-1",
        targetUserId: "user-2",
      });
    } catch (error) {
      expect((error as V1ServiceError).code).toBe("forbidden");
    }
  });
});
