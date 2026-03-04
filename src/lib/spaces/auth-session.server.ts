import { auth } from "#/lib/auth";
import { createHash } from "node:crypto";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type SessionCacheEntry = {
  expiresAt: number;
  user: SessionUser;
};

const SESSION_CACHE_TTL_MS = 5_000;
const sessionUserCache = new Map<string, SessionCacheEntry>();
const sessionUserCacheKeysByUserId = new Map<string, Set<string>>();

async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const cacheKey = getSessionCacheKey(request);
  if (cacheKey) {
    const cached = readCachedSessionUser(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return null;
  }

  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };

  if (cacheKey) {
    writeCachedSessionUser(cacheKey, user);
  }

  return user;
}

export async function requireSessionUser(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

function getSessionCacheKey(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie")?.trim();
  if (!cookieHeader) {
    return null;
  }

  return createHash("sha256").update(cookieHeader).digest("hex");
}

function readCachedSessionUser(cacheKey: string): SessionUser | null {
  const now = Date.now();
  const cached = sessionUserCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= now) {
    sessionUserCache.delete(cacheKey);
    unlinkCacheKeyFromUser(cached.user.id, cacheKey);
    return null;
  }

  return cached.user;
}

function writeCachedSessionUser(cacheKey: string, user: SessionUser): void {
  const previous = sessionUserCache.get(cacheKey);
  if (previous && previous.user.id !== user.id) {
    unlinkCacheKeyFromUser(previous.user.id, cacheKey);
  }

  sessionUserCache.set(cacheKey, {
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
    user,
  });

  const keys = sessionUserCacheKeysByUserId.get(user.id) ?? new Set<string>();
  keys.add(cacheKey);
  sessionUserCacheKeysByUserId.set(user.id, keys);
}

function unlinkCacheKeyFromUser(userId: string, cacheKey: string): void {
  const keys = sessionUserCacheKeysByUserId.get(userId);
  if (!keys) {
    return;
  }

  keys.delete(cacheKey);
  if (keys.size === 0) {
    sessionUserCacheKeysByUserId.delete(userId);
  }
}
