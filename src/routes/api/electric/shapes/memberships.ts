import { createFileRoute } from "@tanstack/react-router";
import {
  fetchElectricShapeRows,
  isElectricShapeProtocolRequest,
  isElectricCloudConfigured,
  proxyElectricShapeRequest,
  quoteSqlLiteral,
} from "#/lib/electric/shape.server";
import { resolveScopedSpaceIdsForUserFromDb } from "#/lib/posts/repository.server";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";
import { listVisibleStateForUserFromDb } from "#/lib/spaces/repository.server";
import type { MembershipRecord, MembershipRole } from "#/lib/spaces/types";

export const Route = createFileRoute("/api/electric/shapes/memberships")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireSessionUser(request);
          const spaceIds = await resolveScopedSpaceIdsForUserFromDb({ userId: user.id });
          const isShapeProtocolRequest = isElectricShapeProtocolRequest(request);
          const where =
            spaceIds.length === 0
              ? "1 = 0"
              : `space_id IN (${spaceIds.map(quoteSqlLiteral).join(",")})`;

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
              table: "memberships",
              where,
              columns: "id,space_id,user_id,role,title,created_at,updated_at",
            });
          }

          if (isElectricCloudConfigured()) {
            try {
              if (spaceIds.length === 0) {
                return Response.json({ rows: [] }, { status: 200 });
              }

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
            } catch (error) {
              console.warn("[electric-shape] Falling back to DB snapshot for memberships.", error);
            }
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
