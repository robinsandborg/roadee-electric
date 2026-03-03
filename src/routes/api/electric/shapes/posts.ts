import { createFileRoute } from "@tanstack/react-router";
import { fetchElectricShapeRows } from "#/lib/electric/shape.server";
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
                where: shapeWhereBySpaceIds("space_id", spaceIds),
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
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
  };
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // no-op
    }
  }

  return {};
}

function toJsonObjectOrNull(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }
  return toJsonObject(value);
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
