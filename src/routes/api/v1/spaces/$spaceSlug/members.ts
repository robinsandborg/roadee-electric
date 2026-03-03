import { createFileRoute } from "@tanstack/react-router";
import { requireSessionUser } from "#/lib/v1/auth-session.server";
import { listMembersBySlugForActorInDb } from "#/lib/v1/repository.server";
import { V1ServiceError } from "#/lib/v1/service";

export const Route = createFileRoute("/api/v1/spaces/$spaceSlug/members")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireSessionUser(request);
          const result = await listMembersBySlugForActorInDb({
            spaceSlug: params.spaceSlug,
            actorUserId: user.id,
          });
          return Response.json(result, { status: 200 });
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
    if (error.code === "membership_required") {
      return errorResponse(403, error.code, error.message);
    }
    return errorResponse(400, error.code, error.message);
  }

  if (error instanceof Error && error.message === "Unauthorized") {
    return errorResponse(401, "unauthorized", "Authentication required.");
  }

  return errorResponse(500, "unknown_error", "Unexpected error.");
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ code, message }, { status });
}
