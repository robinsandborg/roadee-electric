import { createFileRoute } from "@tanstack/react-router";
import { mapPostsRouteError, parseJsonBody } from "#/lib/posts/http";
import { postsService } from "#/lib/posts/service.server";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";

export const Route = createFileRoute("/api/posts/$postId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireSessionUser(request);
          const thread = await postsService.getPostThreadById({
            postId: params.postId,
            actorUserId: user.id,
          });
          return Response.json(thread, { status: 200 });
        } catch (error) {
          return mapPostsRouteError(error);
        }
      },
      PATCH: async ({ request, params }) => {
        try {
          const user = await requireSessionUser(request);
          const payload = await parseJsonBody(request);

          const updated = await postsService.updateOwnPost({
            postId: params.postId,
            actorUserId: user.id,
            title: String(payload.title ?? ""),
            bodyRichText:
              typeof payload.bodyRichText === "object" && payload.bodyRichText !== null
                ? (payload.bodyRichText as Record<string, unknown>)
                : {},
            imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl : null,
            imageMeta:
              typeof payload.imageMeta === "object" && payload.imageMeta !== null
                ? (payload.imageMeta as Record<string, unknown>)
                : null,
            categoryId: typeof payload.categoryId === "string" ? payload.categoryId : null,
            categoryName: typeof payload.categoryName === "string" ? payload.categoryName : null,
            tagIds: Array.isArray(payload.tagIds)
              ? payload.tagIds.filter((value): value is string => typeof value === "string")
              : [],
            tagNames: Array.isArray(payload.tagNames)
              ? payload.tagNames.filter((value): value is string => typeof value === "string")
              : [],
          });

          return Response.json(updated, { status: 200 });
        } catch (error) {
          return mapPostsRouteError(error);
        }
      },
    },
  },
});
