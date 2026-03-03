/**
 * V1 Electric hook-in point.
 *
 * In local dev without Electric configured, we sync via app API polling.
 * When `VITE_ELECTRIC_SHAPE_PROXY_URL` is defined, this module exposes shape URLs
 * that can be consumed by a streaming client.
 */
export function getElectricShapeProxyUrl(): string | null {
  const value = import.meta.env.VITE_ELECTRIC_SHAPE_PROXY_URL;
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return value;
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
