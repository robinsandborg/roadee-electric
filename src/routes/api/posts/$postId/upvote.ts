import { createFileRoute } from "@tanstack/react-router";
import { mapPostsRouteError, parseJsonBody } from "#/lib/posts/http";
import { postsService } from "#/lib/posts/service.server";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";

export const Route = createFileRoute("/api/posts/$postId/upvote")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const user = await requireSessionUser(request);
          const payload = await parseJsonBody(request);

          const toggled = await postsService.toggleUpvote({
            id: typeof payload.id === "string" ? payload.id : undefined,
            postId: params.postId,
            actorUserId: user.id,
          });

          return Response.json(toggled, { status: 200 });
        } catch (error) {
          return mapPostsRouteError(error);
        }
      },
    },
  },
});
