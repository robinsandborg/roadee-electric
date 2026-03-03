import { createFileRoute } from "@tanstack/react-router";
import { requireSessionUser } from "#/lib/v1/auth-session.server";
import { promoteMemberToStaffInDb } from "#/lib/v1/repository.server";
import { V1ServiceError } from "#/lib/v1/service";

export const Route = createFileRoute("/api/v1/spaces/promote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireSessionUser(request);
          const payload = await parseJsonBody(request);

          const spaceSlug = String(payload.spaceSlug ?? "").trim();
          const targetUserId = String(payload.targetUserId ?? "").trim();

          if (!spaceSlug || !targetUserId) {
            return errorResponse(400, "invalid_input", "spaceSlug and targetUserId are required.");
          }

          const result = await promoteMemberToStaffInDb({
            spaceSlug,
            actorUserId: user.id,
            targetUserId,
          });

          return Response.json({ membership: result.membership }, { status: 200 });
        } catch (error) {
          return mapRouteError(error);
        }
      },
    },
  },
});

function mapRouteError(error: unknown): Response {
  if (error instanceof V1ServiceError) {
    if (error.code === "space_not_found") {
      return errorResponse(404, error.code, error.message);
    }
    if (error.code === "forbidden") {
      return errorResponse(403, error.code, error.message);
    }
    return errorResponse(400, error.code, error.message);
  }

  if (error instanceof Error && error.message === "Unauthorized") {
    return errorResponse(401, "unauthorized", "Authentication required.");
  }

  return errorResponse(500, "unknown_error", "Unexpected error.");
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ code, message }, { status });
}
