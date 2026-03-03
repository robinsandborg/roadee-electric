export const appRoutes = {
  home: "/" as const,
  about: "/about" as const,
  createSpace: "/spaces/new" as const,
  spaceBySlug: (spaceSlug: string) => ({
    to: "/s/$spaceSlug" as const,
    params: { spaceSlug },
  }),
  newPostBySpaceSlug: (spaceSlug: string) => ({
    to: "/s/$spaceSlug/new" as const,
    params: { spaceSlug },
  }),
  postById: (spaceSlug: string, postId: string) => ({
    to: "/s/$spaceSlug/p/$postId" as const,
    params: { spaceSlug, postId },
  }),
  editPostById: (spaceSlug: string, postId: string) => ({
    to: "/s/$spaceSlug/p/$postId/edit" as const,
    params: { spaceSlug, postId },
  }),
  membersSettingsBySlug: (spaceSlug: string) => ({
    to: "/s/$spaceSlug/settings/members" as const,
    params: { spaceSlug },
  }),
};
