import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, mapPostsRouteError } from "#/lib/posts/http";
import { postsService } from "#/lib/posts/service.server";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";

export const Route = createFileRoute("/api/posts/taxonomy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireSessionUser(request);
          const url = new URL(request.url);
          const spaceSlug = url.searchParams.get("spaceSlug")?.trim() ?? "";
          if (!spaceSlug) {
            return errorResponse(422, "invalid_input", "spaceSlug is required.");
          }

          const result = await postsService.listTaxonomyBySpace({
            spaceSlug,
            actorUserId: user.id,
          });

          return Response.json(result, { status: 200 });
        } catch (error) {
          return mapPostsRouteError(error);
        }
      },
    },
  },
});
