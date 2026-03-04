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
import type { PostUpvoteRecord } from "#/lib/posts/types";

export const Route = createFileRoute("/api/electric/shapes/post-upvotes")({
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
              table: "post_upvotes",
              where,
              columns: "id,post_id,space_id,user_id,created_at",
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
                table: "post_upvotes",
                where,
              });

              return Response.json({ rows: rows.map(mapElectricPostUpvoteRow) }, { status: 200 });
            } catch (error) {
              console.warn("[electric-shape] Falling back to DB snapshot for post-upvotes.", error);
            }
          }

          const snapshot = await fetchFallbackSnapshot(spaceIds);
          return Response.json({ rows: snapshot.postUpvotes }, { status: 200 });
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
              message: "Could not fetch post upvotes shape data.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});

function mapElectricPostUpvoteRow(row: Record<string, unknown>): PostUpvoteRecord {
  return {
    id: String(row.id ?? ""),
    postId: String(row.post_id ?? ""),
    spaceId: String(row.space_id ?? ""),
    userId: String(row.user_id ?? ""),
    createdAt: toISOString(row.created_at),
  };
}

function toISOString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }

  return parsed.toISOString();
}
