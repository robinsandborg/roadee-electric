import { createFileRoute } from "@tanstack/react-router";
import {
  fetchElectricShapeRows,
  isElectricCloudConfigured,
  quoteSqlLiteral,
} from "#/lib/electric/shape.server";
import { requireSessionUser } from "#/lib/v1/auth-session.server";
import { listVisibleStateForUserFromDb } from "#/lib/v1/repository.server";
import type { MembershipRecord, MembershipRole } from "#/lib/v1/types";

export const Route = createFileRoute("/api/electric/shapes/memberships")({
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

            const where = `space_id IN (${spaceIds.map(quoteSqlLiteral).join(",")})`;
            const membershipsRows = await fetchElectricShapeRows({
              table: "memberships",
              where,
            });
            return Response.json(
              {
                rows: membershipsRows.map(mapElectricMembershipRow),
              },
              { status: 200 },
            );
          }

          const visible = await listVisibleStateForUserFromDb(user.id);
          return Response.json({ rows: visible.memberships }, { status: 200 });
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
              message: "Could not fetch memberships shape data.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});

function mapElectricMembershipRow(row: Record<string, unknown>): MembershipRecord {
  return {
    id: String(row.id ?? ""),
    spaceId: String(row.space_id ?? ""),
    userId: String(row.user_id ?? ""),
    role: toMembershipRole(row.role),
    title: typeof row.title === "string" ? row.title : null,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
  };
}

function toMembershipRole(value: unknown): MembershipRole {
  if (value === "owner" || value === "staff" || value === "user") {
    return value;
  }
  return "user";
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
