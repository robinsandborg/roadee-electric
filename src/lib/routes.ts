export const appRoutes = {
  home: "/" as const,
  about: "/about" as const,
  createSpace: "/spaces/new" as const,
  spaceBySlug: (spaceSlug: string) => ({
    to: "/s/$spaceSlug" as const,
    params: { spaceSlug },
  }),
  membersSettingsBySlug: (spaceSlug: string) => ({
    to: "/s/$spaceSlug/settings/members" as const,
    params: { spaceSlug },
  }),
};
