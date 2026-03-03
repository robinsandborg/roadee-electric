import {
  membershipsCollection,
  spacesCollection,
  upsertMembership,
  upsertSpace,
  type Membership,
  type Space,
} from "#/db-collections";
import {
  getMembershipsShapeUrl,
  getSpacesShapeUrl,
  isElectricShapeSyncEnabled,
} from "#/lib/electric/client";
import { fetchVisibleSpacesSnapshot } from "#/lib/spaces/api-client";

export async function syncVisibleSpacesIntoCollections(): Promise<void> {
  if (isElectricShapeSyncEnabled()) {
    try {
      const shapeSnapshot = await fetchShapeSnapshot();
      applySnapshot(shapeSnapshot.spaces, shapeSnapshot.memberships);
      return;
    } catch {
      // Fall through to API snapshot when shape proxy calls fail.
    }
  }

  const snapshot = await fetchVisibleSpacesSnapshot();
  applySnapshot(snapshot.spaces, snapshot.memberships);
}

export function applySnapshot(spaces: Space[], memberships: Membership[]): void {
  for (const space of spaces) {
    upsertSpace(space);
  }

  for (const membership of memberships) {
    upsertMembership(membership);
  }

  pruneMissing(spaces, memberships);
}

function pruneMissing(spaces: Space[], memberships: Membership[]): void {
  const spaceIds = new Set(spaces.map((space) => space.id));
  const membershipIds = new Set(memberships.map((membership) => membership.id));

  for (const [spaceId] of spacesCollection.entries()) {
    if (!spaceIds.has(String(spaceId))) {
      spacesCollection.delete(spaceId);
    }
  }

  for (const [membershipId] of membershipsCollection.entries()) {
    if (!membershipIds.has(String(membershipId))) {
      membershipsCollection.delete(membershipId);
    }
  }
}

async function fetchShapeSnapshot(): Promise<{
  spaces: Space[];
  memberships: Membership[];
}> {
  const spacesUrl = getSpacesShapeUrl();
  const membershipsUrl = getMembershipsShapeUrl();
  if (!spacesUrl || !membershipsUrl) {
    return {
      spaces: [],
      memberships: [],
    };
  }

  const [spacesResponse, membershipsResponse] = await Promise.all([
    fetch(spacesUrl, { credentials: "include" }),
    fetch(membershipsUrl, { credentials: "include" }),
  ]);

  const spacesPayload = await safeJson(spacesResponse);
  const membershipsPayload = await safeJson(membershipsResponse);
  if (!spacesResponse.ok || !membershipsResponse.ok) {
    throw new Error("Shape proxy request failed.");
  }

  return {
    spaces: Array.isArray((spacesPayload as { rows?: unknown[] }).rows)
      ? ((spacesPayload as { rows: Space[] }).rows ?? [])
      : [],
    memberships: Array.isArray((membershipsPayload as { rows?: unknown[] }).rows)
      ? ((membershipsPayload as { rows: Membership[] }).rows ?? [])
      : [],
  };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
