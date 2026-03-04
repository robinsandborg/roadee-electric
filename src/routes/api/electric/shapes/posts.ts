import { createFileRoute } from "@tanstack/react-router";
import {
  fetchElectricShapeRows,
  isElectricShapeProtocolRequest,
  proxyElectricShapeRequest,
} from "#/lib/electric/shape.server";
import { toIsoString, toJsonObject, toJsonObjectOrNull } from "#/lib/electric/shape-row";
import {
  fetchFallbackSnapshot,
  isElectricShapeBackendEnabled,
  isPostsSchemaAvailable,
  resolveScopedSpaceIdsFromShapeRequest,
  shapeWhereBySpaceIds,
} from "#/lib/posts/shape.server";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";
import type { PostRecord } from "#/lib/posts/types";

export const Route = createFileRoute("/api/electric/shapes/posts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireSessionUser(request);
          const spaceIds = await resolveScopedSpaceIdsFromShapeRequest(request, user.id);
          const isShapeProtocolRequest = isElectricShapeProtocolRequest(request);
          const where =
            spaceIds.length === 0 ? "1 = 0" : shapeWhereBySpaceIds("space_id", spaceIds);

          if (isShapeProtocolRequest) {
            if (!isElectricShapeBackendEnabled() || !(await isPostsSchemaAvailable())) {
              return Response.json(
                {
                  code: "electric_unavailable",
                  message: "Electric shape streaming is not available.",
                },
                { status: 503 },
              );
            }

            return proxyElectricShapeRequest({
              request,
              table: "posts",
              where,
              columns:
                "id,space_id,author_id,title,body_rich_text,image_url,image_meta,category_id,created_at,updated_at",
            });
          }

          if (spaceIds.length === 0) {
            return Response.json({ rows: [] }, { status: 200 });
          }

          if (!(await isPostsSchemaAvailable())) {
            return Response.json({ rows: [] }, { status: 200 });
          }

          if (isElectricShapeBackendEnabled()) {
            try {
              const rows = await fetchElectricShapeRows({
                table: "posts",
                where,
              });

              return Response.json({ rows: rows.map(mapElectricPostRow) }, { status: 200 });
            } catch (error) {
              console.warn("[electric-shape] Falling back to DB snapshot for posts.", error);
            }
          }

          const snapshot = await fetchFallbackSnapshot(spaceIds);
          return Response.json({ rows: snapshot.posts }, { status: 200 });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return Response.json(
              {
                code: "unauthorized",
                message: "Authentication required.",
              },
              { status: 401 },
            );
          }

          return Response.json(
            {
              code: "shape_proxy_error",
              message: "Could not fetch posts shape data.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});

function mapElectricPostRow(row: Record<string, unknown>): PostRecord {
  return {
    id: String(row.id ?? ""),
    spaceId: String(row.space_id ?? ""),
    authorId: String(row.author_id ?? ""),
    title: String(row.title ?? ""),
    bodyRichText: toJsonObject(row.body_rich_text),
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    imageMeta: toJsonObjectOrNull(row.image_meta),
    categoryId: typeof row.category_id === "string" ? row.category_id : null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}
