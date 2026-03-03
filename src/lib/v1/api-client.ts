import type { Membership, Space } from "#/db-collections";

export class V1ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "V1ApiError";
    this.status = status;
    this.code = code;
  }
}

type SpaceSnapshot = {
  spaces: Space[];
  memberships: Membership[];
};

export async function fetchVisibleSpacesSnapshot(): Promise<SpaceSnapshot> {
  return requestJson<SpaceSnapshot>("/api/v1/spaces", {
    method: "GET",
  });
}

export async function createSpaceRequest(input: {
  id: string;
  ownerMembershipId: string;
  name: string;
  slug: string;
  description: string;
}): Promise<{
  space: Space;
  ownerMembership: Membership;
}> {
  return requestJson("/api/v1/spaces", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function joinSpaceBySlugRequest(input: {
  membershipId: string;
  spaceSlug: string;
}): Promise<{
  space: Space;
  membership: Membership;
  created: boolean;
}> {
  return requestJson("/api/v1/spaces/join", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchMembersForSpace(spaceSlug: string): Promise<{
  space: Space;
  memberships: Membership[];
  actorRole: "owner" | "staff" | "user";
}> {
  return requestJson(`/api/v1/spaces/${encodeURIComponent(spaceSlug)}/members`, {
    method: "GET",
  });
}

export async function promoteMemberToStaffRequest(input: {
  spaceSlug: string;
  targetUserId: string;
}): Promise<{
  membership: Membership;
}> {
  return requestJson("/api/v1/spaces/promote", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const payload = (await safeJson(response)) as { code?: string; message?: string } & T;
  if (!response.ok) {
    throw new V1ApiError(
      payload.message ?? "Request failed",
      response.status,
      payload.code ?? "request_failed",
    );
  }

  return payload;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
