import { isValidSpaceSlug, normalizeSpaceSlug } from "#/lib/space-slug";
import type {
  ActorSummary,
  MembershipRecord,
  MembershipRole,
  SpaceRecord,
  SpacesState,
} from "#/lib/spaces/types";

export class SpacesServiceError extends Error {
  code:
    | "slug_conflict"
    | "invalid_slug"
    | "space_not_found"
    | "membership_required"
    | "forbidden"
    | "target_not_found";

  constructor(
    code:
      | "slug_conflict"
      | "invalid_slug"
      | "space_not_found"
      | "membership_required"
      | "forbidden"
      | "target_not_found",
    message: string,
  ) {
    super(message);
    this.name = "SpacesServiceError";
    this.code = code;
  }
}

type CreateSpaceInput = {
  id?: string;
  ownerMembershipId?: string;
  name: string;
  slug: string;
  description: string;
  createdBy: string;
  now?: string;
};

type JoinSpaceBySlugInput = {
  membershipId?: string;
  spaceSlug: string;
  userId: string;
  now?: string;
};

type PromoteMemberInput = {
  spaceSlug: string;
  actorUserId: string;
  targetUserId: string;
  title?: string | null;
  now?: string;
};

export function createSpace(
  state: SpacesState,
  input: CreateSpaceInput,
): {
  space: SpaceRecord;
  ownerMembership: MembershipRecord;
} {
  const slug = normalizeSpaceSlug(input.slug);
  if (!isValidSpaceSlug(slug)) {
    throw new SpacesServiceError(
      "invalid_slug",
      "Slug must be lowercase letters, numbers, and dashes.",
    );
  }

  const existingSpace = state.spaces.find((space) => space.slug === slug);
  if (existingSpace) {
    throw new SpacesServiceError("slug_conflict", "A space with this slug already exists.");
  }

  const now = input.now ?? new Date().toISOString();

  const space: SpaceRecord = {
    id: input.id ?? crypto.randomUUID(),
    slug,
    name: input.name.trim(),
    description: input.description.trim(),
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  const ownerMembership: MembershipRecord = {
    id: input.ownerMembershipId ?? crypto.randomUUID(),
    spaceId: space.id,
    userId: input.createdBy,
    role: "owner",
    title: null,
    createdAt: now,
    updatedAt: now,
  };

  state.spaces.push(space);
  state.memberships.push(ownerMembership);

  return { space, ownerMembership };
}

export function joinSpaceBySlug(
  state: SpacesState,
  input: JoinSpaceBySlugInput,
): {
  space: SpaceRecord;
  membership: MembershipRecord;
  created: boolean;
} {
  const slug = normalizeSpaceSlug(input.spaceSlug);
  const space = state.spaces.find((candidate) => candidate.slug === slug);
  if (!space) {
    throw new SpacesServiceError("space_not_found", "Space not found.");
  }

  const existingMembership = state.memberships.find(
    (membership) => membership.spaceId === space.id && membership.userId === input.userId,
  );

  if (existingMembership) {
    return {
      space,
      membership: existingMembership,
      created: false,
    };
  }

  const now = input.now ?? new Date().toISOString();
  const membership: MembershipRecord = {
    id: input.membershipId ?? crypto.randomUUID(),
    spaceId: space.id,
    userId: input.userId,
    role: "user",
    title: null,
    createdAt: now,
    updatedAt: now,
  };

  state.memberships.push(membership);

  return {
    space,
    membership,
    created: true,
  };
}

export function promoteMemberToStaff(
  state: SpacesState,
  input: PromoteMemberInput,
): {
  space: SpaceRecord;
  membership: MembershipRecord;
  actor: ActorSummary;
} {
  const slug = normalizeSpaceSlug(input.spaceSlug);
  const space = state.spaces.find((candidate) => candidate.slug === slug);
  if (!space) {
    throw new SpacesServiceError("space_not_found", "Space not found.");
  }

  const actorMembership = findMembership(state, space.id, input.actorUserId);
  if (!actorMembership) {
    throw new SpacesServiceError("membership_required", "You must be a member of this space.");
  }

  if (!isStaffRole(actorMembership.role)) {
    throw new SpacesServiceError("forbidden", "Only owner or staff can promote members.");
  }

  const targetMembership = findMembership(state, space.id, input.targetUserId);
  if (!targetMembership) {
    throw new SpacesServiceError("target_not_found", "Target member not found.");
  }

  if (targetMembership.role !== "owner") {
    targetMembership.role = "staff";
  }
  targetMembership.title = input.title ?? targetMembership.title;
  targetMembership.updatedAt = input.now ?? new Date().toISOString();

  return {
    space,
    membership: targetMembership,
    actor: {
      userId: actorMembership.userId,
      role: actorMembership.role,
    },
  };
}

function findMembership(
  state: SpacesState,
  spaceId: string,
  userId: string,
): MembershipRecord | undefined {
  return state.memberships.find(
    (membership) => membership.spaceId === spaceId && membership.userId === userId,
  );
}

function isStaffRole(role: MembershipRole): boolean {
  return role === "owner" || role === "staff";
}
