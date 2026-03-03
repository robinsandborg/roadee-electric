export type MembershipRole = "owner" | "staff" | "user";

export type SpaceRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MembershipRecord = {
  id: string;
  spaceId: string;
  userId: string;
  role: MembershipRole;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type V1State = {
  spaces: SpaceRecord[];
  memberships: MembershipRecord[];
};

export type ActorSummary = {
  userId: string;
  role: MembershipRole;
};
