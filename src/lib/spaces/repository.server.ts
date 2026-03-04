import type { PoolClient } from "pg";
import { getPostgresPool } from "#/lib/postgres.server";
import { isValidSpaceSlug, normalizeSpaceSlug } from "#/lib/space-slug";
import { SpacesServiceError } from "#/lib/spaces/service";
import type {
  MembershipRecord,
  MembershipRole,
  SpaceRecord,
  SpacesState,
} from "#/lib/spaces/types";

type SpaceRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

type MembershipRow = {
  id: string;
  space_id: string;
  user_id: string;
  role: MembershipRole;
  title: string | null;
  created_at: Date;
  updated_at: Date;
};

type SpaceAndMembershipRow = {
  space_id: string;
  space_slug: string;
  space_name: string;
  space_description: string;
  space_created_by: string;
  space_created_at: Date;
  space_updated_at: Date;
  membership_id: string;
  membership_space_id: string;
  membership_user_id: string;
  membership_role: MembershipRole;
  membership_title: string | null;
  membership_created_at: Date;
  membership_updated_at: Date;
};

export async function listVisibleStateForUserFromDb(userId: string): Promise<SpacesState> {
  const pool = getPostgresPool();

  const spacesResult = await pool.query<SpaceRow>(
    `
      SELECT DISTINCT s.id, s.slug, s.name, s.description, s.created_by, s.created_at, s.updated_at
      FROM spaces AS s
      INNER JOIN memberships AS visible ON visible.space_id = s.id
      WHERE visible.user_id = $1
      ORDER BY s.created_at DESC
    `,
    [userId],
  );

  const spaces = spacesResult.rows.map(mapSpaceRow);
  if (spaces.length === 0) {
    return {
      spaces: [],
      memberships: [],
    };
  }

  const spaceIds = spaces.map((space) => space.id);
  const membershipsResult = await pool.query<MembershipRow>(
    `
      SELECT m.id, m.space_id, m.user_id, m.role, m.title, m.created_at, m.updated_at
      FROM memberships AS m
      WHERE m.space_id = ANY($1::text[])
      ORDER BY m.created_at ASC
    `,
    [spaceIds],
  );

  return {
    spaces,
    memberships: membershipsResult.rows.map(mapMembershipRow),
  };
}

export async function createSpaceWithOwnerInDb(input: {
  id?: string;
  ownerMembershipId?: string;
  name: string;
  slug: string;
  description: string;
  createdBy: string;
}): Promise<{
  space: SpaceRecord;
  ownerMembership: MembershipRecord;
}> {
  const normalizedSlug = normalizeSpaceSlug(input.slug);
  if (!isValidSpaceSlug(normalizedSlug)) {
    throw new SpacesServiceError(
      "invalid_slug",
      "Slug must be lowercase letters, numbers, and dashes.",
    );
  }

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const spaceId = input.id ?? crypto.randomUUID();
    const ownerMembershipId = input.ownerMembershipId ?? crypto.randomUUID();
    const now = new Date();

    const spaceResult = await client.query<SpaceRow>(
      `
        INSERT INTO spaces (id, slug, name, description, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        RETURNING id, slug, name, description, created_by, created_at, updated_at
      `,
      [spaceId, normalizedSlug, input.name.trim(), input.description.trim(), input.createdBy, now],
    );

    const ownerMembershipResult = await client.query<MembershipRow>(
      `
        INSERT INTO memberships (id, space_id, user_id, role, title, created_at, updated_at)
        VALUES ($1, $2, $3, 'owner', NULL, $4, $4)
        RETURNING id, space_id, user_id, role, title, created_at, updated_at
      `,
      [ownerMembershipId, spaceId, input.createdBy, now],
    );

    await client.query("COMMIT");

    return {
      space: mapSpaceRow(spaceResult.rows[0]!),
      ownerMembership: mapMembershipRow(ownerMembershipResult.rows[0]!),
    };
  } catch (error) {
    await safeRollback(client);
    if (isUniqueViolation(error)) {
      throw new SpacesServiceError("slug_conflict", "A space with this slug already exists.");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function joinSpaceBySlugInDb(input: {
  membershipId?: string;
  spaceSlug: string;
  userId: string;
}): Promise<{
  space: SpaceRecord;
  membership: MembershipRecord;
  created: boolean;
}> {
  const normalizedSlug = normalizeSpaceSlug(input.spaceSlug);
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const spaceResult = await client.query<SpaceRow>(
      `
        SELECT id, slug, name, description, created_by, created_at, updated_at
        FROM spaces
        WHERE slug = $1
      `,
      [normalizedSlug],
    );
    const spaceRow = spaceResult.rows[0];
    if (!spaceRow) {
      throw new SpacesServiceError("space_not_found", "Space not found.");
    }

    const existingMembershipResult = await client.query<MembershipRow>(
      `
        SELECT id, space_id, user_id, role, title, created_at, updated_at
        FROM memberships
        WHERE space_id = $1 AND user_id = $2
      `,
      [spaceRow.id, input.userId],
    );
    if (existingMembershipResult.rows[0]) {
      await client.query("COMMIT");
      return {
        space: mapSpaceRow(spaceRow),
        membership: mapMembershipRow(existingMembershipResult.rows[0]),
        created: false,
      };
    }

    const now = new Date();
    const insertMembershipResult = await client.query<MembershipRow>(
      `
        INSERT INTO memberships (id, space_id, user_id, role, title, created_at, updated_at)
        VALUES ($1, $2, $3, 'user', NULL, $4, $4)
        RETURNING id, space_id, user_id, role, title, created_at, updated_at
      `,
      [input.membershipId ?? crypto.randomUUID(), spaceRow.id, input.userId, now],
    );

    await client.query("COMMIT");
    return {
      space: mapSpaceRow(spaceRow),
      membership: mapMembershipRow(insertMembershipResult.rows[0]!),
      created: true,
    };
  } catch (error) {
    await safeRollback(client);
    if (error instanceof SpacesServiceError) {
      throw error;
    }

    if (isUniqueViolation(error)) {
      const spaceAndMembership = await findMembershipBySlugAndUser(normalizedSlug, input.userId);
      if (spaceAndMembership) {
        return {
          space: spaceAndMembership.space,
          membership: spaceAndMembership.membership,
          created: false,
        };
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function listMembersBySlugForActorInDb(input: {
  spaceSlug: string;
  actorUserId: string;
}): Promise<{
  space: SpaceRecord;
  memberships: MembershipRecord[];
  actorRole: MembershipRole;
}> {
  const normalizedSlug = normalizeSpaceSlug(input.spaceSlug);
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const spaceResult = await client.query<SpaceRow>(
      `
        SELECT id, slug, name, description, created_by, created_at, updated_at
        FROM spaces
        WHERE slug = $1
      `,
      [normalizedSlug],
    );
    const spaceRow = spaceResult.rows[0];
    if (!spaceRow) {
      throw new SpacesServiceError("space_not_found", "Space not found.");
    }

    const actorMembershipResult = await client.query<MembershipRow>(
      `
        SELECT id, space_id, user_id, role, title, created_at, updated_at
        FROM memberships
        WHERE space_id = $1 AND user_id = $2
      `,
      [spaceRow.id, input.actorUserId],
    );
    const actorMembership = actorMembershipResult.rows[0];
    if (!actorMembership) {
      throw new SpacesServiceError("membership_required", "You are not a member of this space.");
    }

    const membershipsResult = await client.query<MembershipRow>(
      `
        SELECT id, space_id, user_id, role, title, created_at, updated_at
        FROM memberships
        WHERE space_id = $1
        ORDER BY created_at ASC
      `,
      [spaceRow.id],
    );

    return {
      space: mapSpaceRow(spaceRow),
      memberships: membershipsResult.rows.map(mapMembershipRow),
      actorRole: actorMembership.role,
    };
  } finally {
    client.release();
  }
}

export async function promoteMemberToStaffInDb(input: {
  spaceSlug: string;
  actorUserId: string;
  targetUserId: string;
}): Promise<{
  membership: MembershipRecord;
  txid: number;
}> {
  const normalizedSlug = normalizeSpaceSlug(input.spaceSlug);
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const spaceResult = await client.query<{ id: string }>(
      `
        SELECT id
        FROM spaces
        WHERE slug = $1
      `,
      [normalizedSlug],
    );
    const spaceId = spaceResult.rows[0]?.id;
    if (!spaceId) {
      throw new SpacesServiceError("space_not_found", "Space not found.");
    }

    const actorResult = await client.query<{ role: MembershipRole }>(
      `
        SELECT role
        FROM memberships
        WHERE space_id = $1 AND user_id = $2
      `,
      [spaceId, input.actorUserId],
    );
    const actorRole = actorResult.rows[0]?.role;
    if (!actorRole) {
      throw new SpacesServiceError("membership_required", "You must be a member of this space.");
    }
    if (actorRole !== "owner" && actorRole !== "staff") {
      throw new SpacesServiceError("forbidden", "Only owner or staff can promote members.");
    }

    const updateResult = await client.query<MembershipRow>(
      `
        UPDATE memberships
        SET role = CASE WHEN role = 'owner' THEN role ELSE 'staff' END,
            updated_at = NOW()
        WHERE space_id = $1 AND user_id = $2
        RETURNING id, space_id, user_id, role, title, created_at, updated_at
      `,
      [spaceId, input.targetUserId],
    );

    if (!updateResult.rows[0]) {
      throw new SpacesServiceError("target_not_found", "Target member not found.");
    }
    const txid = await getCurrentTxId(client);

    await client.query("COMMIT");
    return {
      membership: mapMembershipRow(updateResult.rows[0]),
      txid,
    };
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

function mapSpaceRow(row: SpaceRow): SpaceRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMembershipRow(row: MembershipRow): MembershipRecord {
  return {
    id: row.id,
    spaceId: row.space_id,
    userId: row.user_id,
    role: row.role,
    title: row.title,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

async function findMembershipBySlugAndUser(
  slug: string,
  userId: string,
): Promise<{
  space: SpaceRecord;
  membership: MembershipRecord;
} | null> {
  const pool = getPostgresPool();
  const result = await pool.query<SpaceAndMembershipRow>(
    `
      SELECT
        s.id AS space_id,
        s.slug AS space_slug,
        s.name AS space_name,
        s.description AS space_description,
        s.created_by AS space_created_by,
        s.created_at AS space_created_at,
        s.updated_at AS space_updated_at,
        m.id AS membership_id,
        m.space_id AS membership_space_id,
        m.user_id AS membership_user_id,
        m.role AS membership_role,
        m.title AS membership_title,
        m.created_at AS membership_created_at,
        m.updated_at AS membership_updated_at
      FROM spaces AS s
      INNER JOIN memberships AS m ON m.space_id = s.id
      WHERE s.slug = $1 AND m.user_id = $2
      LIMIT 1
    `,
    [slug, userId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const space: SpaceRecord = {
    id: row.space_id,
    slug: row.space_slug,
    name: row.space_name,
    description: row.space_description,
    createdBy: row.space_created_by,
    createdAt: row.space_created_at.toISOString(),
    updatedAt: row.space_updated_at.toISOString(),
  };
  const membership: MembershipRecord = {
    id: row.membership_id,
    spaceId: row.membership_space_id,
    userId: row.membership_user_id,
    role: row.membership_role,
    title: row.membership_title,
    createdAt: row.membership_created_at.toISOString(),
    updatedAt: row.membership_updated_at.toISOString(),
  };

  return { space, membership };
}

async function safeRollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // no-op
  }
}

async function getCurrentTxId(client: PoolClient): Promise<number> {
  const result = await client.query<{ txid: string }>(
    `
      SELECT txid_current()::text AS txid
    `,
  );
  return Number(result.rows[0]?.txid ?? "0");
}
