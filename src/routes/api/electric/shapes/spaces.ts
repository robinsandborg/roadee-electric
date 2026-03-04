import { createFileRoute } from "@tanstack/react-router";
import {
  fetchElectricShapeRows,
  isElectricShapeProtocolRequest,
  isElectricCloudConfigured,
  proxyElectricShapeRequest,
  quoteSqlLiteral,
} from "#/lib/electric/shape.server";
import { toIsoString } from "#/lib/electric/shape-row";
import { resolveScopedSpaceIdsForUserFromDb } from "#/lib/posts/repository.server";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";
import { listVisibleStateForUserFromDb } from "#/lib/spaces/repository.server";
import type { SpaceRecord } from "#/lib/spaces/types";

export const Route = createFileRoute("/api/electric/shapes/spaces")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireSessionUser(request);
          const spaceIds = await resolveScopedSpaceIdsForUserFromDb({ userId: user.id });
          const isShapeProtocolRequest = isElectricShapeProtocolRequest(request);
          const where =
            spaceIds.length === 0 ? "1 = 0" : `id IN (${spaceIds.map(quoteSqlLiteral).join(",")})`;

          if (isShapeProtocolRequest) {
            if (!isElectricCloudConfigured()) {
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
              table: "spaces",
              where,
              columns: "id,slug,name,description,created_by,created_at,updated_at",
            });
          }

          if (isElectricCloudConfigured()) {
            try {
              if (spaceIds.length === 0) {
                return Response.json({ rows: [] }, { status: 200 });
              }

              const spaceRows = await fetchElectricShapeRows({
                table: "spaces",
                where,
              });

              return Response.json(
                {
                  rows: spaceRows.map(mapElectricSpaceRow),
                },
                { status: 200 },
              );
            } catch (error) {
              console.warn("[electric-shape] Falling back to DB snapshot for spaces.", error);
            }
          }

          const visible = await listVisibleStateForUserFromDb(user.id);
          return Response.json({ rows: visible.spaces }, { status: 200 });
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
              message: "Could not fetch spaces shape data.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});

function mapElectricSpaceRow(row: Record<string, unknown>): SpaceRecord {
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}
