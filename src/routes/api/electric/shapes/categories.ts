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
import type { CategoryRecord } from "#/lib/posts/types";

export const Route = createFileRoute("/api/electric/shapes/categories")({
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
              table: "categories",
              where,
              columns: "id,space_id,name,kind,created_at",
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
                table: "categories",
                where,
              });

              return Response.json({ rows: rows.map(mapElectricCategoryRow) }, { status: 200 });
            } catch (error) {
              console.warn("[electric-shape] Falling back to DB snapshot for categories.", error);
            }
          }

          const snapshot = await fetchFallbackSnapshot(spaceIds);
          return Response.json({ rows: snapshot.categories }, { status: 200 });
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
              message: "Could not fetch categories shape data.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});

function mapElectricCategoryRow(row: Record<string, unknown>): CategoryRecord {
  return {
    id: String(row.id ?? ""),
    spaceId: String(row.space_id ?? ""),
    name: String(row.name ?? ""),
    kind: String(row.kind ?? "general"),
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
