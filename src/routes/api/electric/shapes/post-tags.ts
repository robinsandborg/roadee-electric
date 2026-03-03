import { createFileRoute } from "@tanstack/react-router";
import { fetchElectricShapeRows, quoteSqlLiteral } from "#/lib/electric/shape.server";
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
          if (spaceIds.length === 0) {
            return Response.json({ rows: [] }, { status: 200 });
          }

          if (!(await isPostsSchemaAvailable())) {
            return Response.json({ rows: [] }, { status: 200 });
          }

          if (isElectricShapeBackendEnabled()) {
            try {
              // Electric where-clause parser does not support subqueries.
              const postRows = await fetchElectricShapeRows({
                table: "posts",
                where: shapeWhereBySpaceIds("space_id", spaceIds),
              });
              const postIds = Array.from(
                new Set(
                  postRows
                    .map((row) => (typeof row.id === "string" ? row.id : null))
                    .filter((value): value is string => Boolean(value)),
                ),
              );
              if (postIds.length === 0) {
                return Response.json({ rows: [] }, { status: 200 });
              }

              const where = `post_id IN (${postIds.map(quoteSqlLiteral).join(",")})`;
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
  };
}
