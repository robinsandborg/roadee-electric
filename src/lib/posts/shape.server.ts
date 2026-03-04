import {
  fetchElectricShapeRows,
  isElectricCloudConfigured,
  quoteSqlLiteral,
} from "#/lib/electric/shape.server";
import { getPostgresPool } from "#/lib/postgres.server";
import {
  listPostsShapeRowsForSpaceIdsFromDb,
  resolveScopedSpaceIdsForUserFromDb,
} from "#/lib/posts/repository.server";
import type { PostsSnapshot } from "#/lib/posts/types";

const POSTS_REQUIRED_TABLES = [
  "posts",
  "comments",
  "post_upvotes",
  "categories",
  "tags",
  "post_tags",
] as const;

let postsSchemaCache: { checkedAt: number; available: boolean } | null = null;
const POSTS_SCHEMA_CACHE_TTL_MS = 30_000;

export async function resolveScopedSpaceIdsFromShapeRequest(
  request: Request,
  userId: string,
): Promise<string[]> {
  const url = new URL(request.url);
  const spaceSlug = url.searchParams.get("spaceSlug")?.trim() || undefined;
  return resolveScopedSpaceIdsForUserFromDb({ userId, spaceSlug });
}

export async function fetchShapeRowsBySpaceIds(input: {
  table: string;
  spaceIds: string[];
  where?: string;
}): Promise<Record<string, unknown>[]> {
  if (input.spaceIds.length === 0) {
    return [];
  }

  if (!isElectricCloudConfigured()) {
    return [];
  }

  const where = input.where ?? `space_id IN (${input.spaceIds.map(quoteSqlLiteral).join(",")})`;

  return fetchElectricShapeRows({
    table: input.table,
    where,
  });
}

export async function fetchFallbackSnapshot(spaceIds: string[]): Promise<PostsSnapshot> {
  const hasPostsSchema = await isPostsSchemaAvailable();
  if (!hasPostsSchema) {
    return emptyPostsSnapshot();
  }

  try {
    return await listPostsShapeRowsForSpaceIdsFromDb(spaceIds);
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return emptyPostsSnapshot();
    }
    throw error;
  }
}

export function shapeWhereBySpaceIds(column: string, spaceIds: string[]): string {
  return `${column} IN (${spaceIds.map(quoteSqlLiteral).join(",")})`;
}

export function isElectricShapeBackendEnabled(): boolean {
  return isElectricCloudConfigured();
}

export async function isPostsSchemaAvailable(): Promise<boolean> {
  const now = Date.now();
  if (postsSchemaCache && now - postsSchemaCache.checkedAt < POSTS_SCHEMA_CACHE_TTL_MS) {
    return postsSchemaCache.available;
  }

  try {
    const pool = getPostgresPool();
    const result = await pool.query<{ table_name: string }>(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
      `,
      [POSTS_REQUIRED_TABLES],
    );

    const available =
      result.rows.length === POSTS_REQUIRED_TABLES.length &&
      POSTS_REQUIRED_TABLES.every((table) => result.rows.some((row) => row.table_name === table));

    postsSchemaCache = { checkedAt: now, available };
    return available;
  } catch {
    postsSchemaCache = { checkedAt: now, available: false };
    return false;
  }
}

function emptyPostsSnapshot(): PostsSnapshot {
  return {
    posts: [],
    comments: [],
    postUpvotes: [],
    categories: [],
    tags: [],
    postTags: [],
  };
}

function isUndefinedTableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  if (code === "42P01") {
    return true;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.toLowerCase().includes("does not exist");
}
