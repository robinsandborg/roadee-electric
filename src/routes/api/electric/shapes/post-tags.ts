import { createFileRoute } from "@tanstack/react-router";
import {
  fetchElectricShapeRows,
  isElectricShapeProtocolRequest,
  proxyElectricShapeRequest,
} from "#/lib/electric/shape.server";
import {
  fetchFallbackSnapshot,
  isElectricShapeBackendEnabled,
  isPostsSchemaAvailable,
  resolveScopedSpaceIdsFromShapeRequest,
  shapeWhereBySpaceIds,
} from "#/lib/posts/shape.server";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";
import type { PostTagRecord } from "#/lib/posts/types";

export const Route = createFileRoute("/api/electric/shapes/post-tags")({
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
              table: "post_tags",
              where,
              columns: "id,post_id,tag_id,space_id",
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
                table: "post_tags",
                where,
              });

              return Response.json({ rows: rows.map(mapElectricPostTagRow) }, { status: 200 });
            } catch (error) {
              console.warn("[electric-shape] Falling back to DB snapshot for post-tags.", error);
            }
          }

          const snapshot = await fetchFallbackSnapshot(spaceIds);
          return Response.json({ rows: snapshot.postTags }, { status: 200 });
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
              message: "Could not fetch post tags shape data.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});

function mapElectricPostTagRow(row: Record<string, unknown>): PostTagRecord {
  return {
    id: String(row.id ?? ""),
    postId: String(row.post_id ?? ""),
    tagId: String(row.tag_id ?? ""),
    spaceId: row.space_id == null ? null : String(row.space_id),
  };
}
