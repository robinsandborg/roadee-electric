import { createFileRoute } from "@tanstack/react-router";
import { parseJsonBody, mapPostsRouteError, errorResponse } from "#/lib/posts/http";
import { postsService } from "#/lib/posts/service.server";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";

export const Route = createFileRoute("/api/posts")({
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

          const [feedResult, taxonomyResult, snapshotResult] = await Promise.all([
            postsService.listFeedBySpace({
              spaceSlug,
              actorUserId: user.id,
            }),
            postsService.listTaxonomyBySpace({
              spaceSlug,
              actorUserId: user.id,
            }),
            postsService.listSnapshotBySpace({
              spaceSlug,
              actorUserId: user.id,
            }),
          ]);

          return Response.json(
            {
              spaceId: feedResult.spaceId,
              feed: feedResult.feed,
              categories: taxonomyResult.categories,
              tags: taxonomyResult.tags,
              snapshot: snapshotResult.snapshot,
            },
            { status: 200 },
          );
        } catch (error) {
          return mapPostsRouteError(error);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireSessionUser(request);
          const payload = await parseJsonBody(request);

          const spaceSlug = String(payload.spaceSlug ?? "").trim();
          if (!spaceSlug) {
            return errorResponse(422, "invalid_input", "spaceSlug is required.");
          }

          const result = await postsService.createPost({
            id: typeof payload.id === "string" ? payload.id : undefined,
            spaceSlug,
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

          return Response.json(result, { status: 201 });
        } catch (error) {
          return mapPostsRouteError(error);
        }
      },
    },
  },
});
