import {
  resolveScopedSpaceIdsForUserFromDb,
  resolveSpaceIdsBySlugFromDb,
} from "#/lib/posts/repository.server";
import { requireSessionUser, type SessionUser } from "#/lib/spaces/auth-session.server";

const SCOPED_SPACE_IDS_CACHE_TTL_MS = 10_000;
const scopedSpaceIdsCache = new Map<string, { expiresAt: number; spaceIds: string[] }>();

export type ShapeScope = {
  user: SessionUser | null;
  spaceIds: string[];
};

export async function resolveShapeScope(
  request: Request,
  options: { allowPublicBySlug?: boolean } = {},
): Promise<ShapeScope> {
  const spaceSlug = getSpaceSlugFromShapeRequest(request);
  if (options.allowPublicBySlug && spaceSlug) {
    const spaceIds = await resolveSpaceIdsBySlugFromDb({ spaceSlug });
    return {
      user: null,
      spaceIds,
    };
  }

  const user = await requireSessionUser(request);
  const spaceIds = await resolveScopedSpaceIdsFromShapeRequest(request, user.id);

  return {
    user,
    spaceIds,
  };
}

export async function resolveScopedSpaceIdsFromShapeRequest(
  request: Request,
  userId: string,
): Promise<string[]> {
  const spaceSlug = getSpaceSlugFromShapeRequest(request);
  const cacheKey = getScopedSpaceIdsCacheKey(userId, spaceSlug);
  const cached = readScopedSpaceIdsCache(cacheKey);
  if (cached) {
    return cached;
  }

  const resolved = await resolveScopedSpaceIdsForUserFromDb({ userId, spaceSlug });
  writeScopedSpaceIdsCache(cacheKey, resolved);
  return resolved;
}

export function buildScopedWhere(column: string, spaceIds: string[]): string {
  if (spaceIds.length === 0) {
    return "1 = 0";
  }
  return `${column} IN (${spaceIds.map(quoteSqlLiteral).join(",")})`;
}

export function invalidateScopedSpaceIdsCacheForUser(userId: string): void {
  const prefix = `${userId}:`;
  for (const key of scopedSpaceIdsCache.keys()) {
    if (key.startsWith(prefix)) {
      scopedSpaceIdsCache.delete(key);
    }
  }
}

export function quoteSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function getSpaceSlugFromShapeRequest(request: Request): string | undefined {
  const url = new URL(request.url);
  const explicitSpaceSlug = normalizeSpaceSlug(url.searchParams.get("spaceSlug"));
  if (explicitSpaceSlug) {
    return explicitSpaceSlug;
  }

  const refererHeader = request.headers.get("referer");
  if (!refererHeader) {
    return undefined;
  }

  try {
    const refererUrl = new URL(refererHeader);
    if (refererUrl.origin !== url.origin) {
      return undefined;
    }
    return getSpaceSlugFromPathname(refererUrl.pathname);
  } catch {
    return undefined;
  }
}

function getSpaceSlugFromPathname(pathname: string): string | undefined {
  const segments = pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments[0] !== "s" || !segments[1]) {
    return undefined;
  }

  try {
    return normalizeSpaceSlug(decodeURIComponent(segments[1]));
  } catch {
    return normalizeSpaceSlug(segments[1]);
  }
}

function normalizeSpaceSlug(value: string | null | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function getScopedSpaceIdsCacheKey(userId: string, spaceSlug: string | undefined): string {
  return `${userId}:${spaceSlug ?? "*"}`;
}

function readScopedSpaceIdsCache(cacheKey: string): string[] | null {
  const cached = scopedSpaceIdsCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    scopedSpaceIdsCache.delete(cacheKey);
    return null;
  }

  return cached.spaceIds;
}

function writeScopedSpaceIdsCache(cacheKey: string, spaceIds: string[]): void {
  scopedSpaceIdsCache.set(cacheKey, {
    expiresAt: Date.now() + SCOPED_SPACE_IDS_CACHE_TTL_MS,
    spaceIds,
  });
}
