import { createFileRoute } from "@tanstack/react-router";
import {
  fetchElectricShapeRows,
  isElectricCloudConfigured,
  quoteSqlLiteral,
} from "#/lib/electric/shape.server";
import { requireSessionUser } from "#/lib/v1/auth-session.server";
import { listVisibleStateForUserFromDb } from "#/lib/v1/repository.server";
import type { SpaceRecord } from "#/lib/v1/types";

export const Route = createFileRoute("/api/electric/shapes/spaces")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireSessionUser(request);
          if (isElectricCloudConfigured()) {
            const ownMembershipRows = await fetchElectricShapeRows({
              table: "memberships",
              where: `user_id = ${quoteSqlLiteral(user.id)}`,
            });

            const spaceIds = Array.from(
              new Set(
                ownMembershipRows
                  .map((row) => (typeof row.space_id === "string" ? row.space_id : null))
                  .filter((value): value is string => Boolean(value)),
              ),
            );

            if (spaceIds.length === 0) {
              return Response.json({ rows: [] }, { status: 200 });
            }

            const where = `id IN (${spaceIds.map(quoteSqlLiteral).join(",")})`;
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
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
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
