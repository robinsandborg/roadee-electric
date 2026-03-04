/**
 * Spaces Electric hook-in point.
 *
 * In local dev without Electric configured, we sync via app API polling.
 * When `VITE_ELECTRIC_SHAPE_PROXY_URL` is defined, this module exposes shape URLs
 * that can be consumed by a streaming client.
 */
export function getElectricShapeProxyUrl(): string | null {
  const value = import.meta.env.VITE_ELECTRIC_SHAPE_PROXY_URL;
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (typeof window !== "undefined") {
    return new URL(trimmed, window.location.origin).toString();
  }

  return trimmed;
}

export function isElectricShapeSyncEnabled(): boolean {
  return Boolean(getElectricShapeProxyUrl());
}

export function getSpacesShapeUrl(): string | null {
  const proxy = getElectricShapeProxyUrl();
  if (!proxy) {
    return null;
  }
  return `${proxy.replace(/\/$/, "")}/spaces`;
}

export function getMembershipsShapeUrl(): string | null {
  const proxy = getElectricShapeProxyUrl();
  if (!proxy) {
    return null;
  }
  return `${proxy.replace(/\/$/, "")}/memberships`;
}

export function getPostsShapeUrl(): string | null {
  const proxy = getElectricShapeProxyUrl();
  if (!proxy) {
    return null;
  }
  return `${proxy.replace(/\/$/, "")}/posts`;
}

export function getCommentsShapeUrl(): string | null {
  const proxy = getElectricShapeProxyUrl();
  if (!proxy) {
    return null;
  }
  return `${proxy.replace(/\/$/, "")}/comments`;
}

export function getPostUpvotesShapeUrl(): string | null {
  const proxy = getElectricShapeProxyUrl();
  if (!proxy) {
    return null;
  }
  return `${proxy.replace(/\/$/, "")}/post-upvotes`;
}

export function getCategoriesShapeUrl(): string | null {
  const proxy = getElectricShapeProxyUrl();
  if (!proxy) {
    return null;
  }
  return `${proxy.replace(/\/$/, "")}/categories`;
}

export function getTagsShapeUrl(): string | null {
  const proxy = getElectricShapeProxyUrl();
  if (!proxy) {
    return null;
  }
  return `${proxy.replace(/\/$/, "")}/tags`;
}

export function getPostTagsShapeUrl(): string | null {
  const proxy = getElectricShapeProxyUrl();
  if (!proxy) {
    return null;
  }
  return `${proxy.replace(/\/$/, "")}/post-tags`;
}
