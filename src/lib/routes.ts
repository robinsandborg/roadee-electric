export const appRoutes = {
  home: "/" as const,
  about: "/about" as const,
  createSpace: "/spaces/new" as const,
  spaceBySlug: (spaceSlug: string) => ({
    to: "/s/$spaceSlug" as const,
    params: { spaceSlug },
  }),
};
