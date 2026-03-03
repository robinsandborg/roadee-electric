const SPACE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSpaceSlug(input: string): string {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return "";
  }

  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, "").replace(/[?#].*$/, "");

  const withoutSpacePrefix = withoutOrigin
    .replace(/^\/+/, "")
    .replace(/^s\//, "")
    .replace(/\/+$/, "");

  return withoutSpacePrefix
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidSpaceSlug(slug: string): boolean {
  return SPACE_SLUG_PATTERN.test(slug);
}
