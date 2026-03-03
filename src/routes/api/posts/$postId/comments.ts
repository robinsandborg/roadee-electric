import { createFileRoute } from "@tanstack/react-router";
import { mapPostsRouteError, parseJsonBody } from "#/lib/posts/http";
import { postsService } from "#/lib/posts/service.server";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";

export const Route = createFileRoute("/api/posts/$postId/comments")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const user = await requireSessionUser(request);
          const payload = await parseJsonBody(request);

          const created = await postsService.createComment({
            id: typeof payload.id === "string" ? payload.id : undefined,
            postId: params.postId,
            actorUserId: user.id,
            bodyRichText:
              typeof payload.bodyRichText === "object" && payload.bodyRichText !== null
                ? (payload.bodyRichText as Record<string, unknown>)
                : {},
          });

          return Response.json(created, { status: 201 });
        } catch (error) {
          return mapPostsRouteError(error);
        }
      },
    },
  },
});
