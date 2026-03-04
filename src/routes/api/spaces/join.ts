import { createFileRoute } from "@tanstack/react-router";
import { invalidateScopedSpaceIdsCacheForUser } from "#/lib/posts/shape.server";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";
import { joinSpaceBySlugInDb } from "#/lib/spaces/repository.server";
import { SpacesServiceError } from "#/lib/spaces/service";

export const Route = createFileRoute("/api/spaces/join")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireSessionUser(request);
          const payload = await parseJsonBody(request);
          const spaceSlug = String(payload.spaceSlug ?? "").trim();
          if (!spaceSlug) {
            return errorResponse(400, "invalid_input", "spaceSlug is required.");
          }

          const result = await joinSpaceBySlugInDb({
            membershipId:
              typeof payload.membershipId === "string" ? payload.membershipId : undefined,
            spaceSlug,
            userId: user.id,
          });
          invalidateScopedSpaceIdsCacheForUser(user.id);

          return Response.json(result, { status: 200 });
        } catch (error) {
          return mapRouteError(error);
        }
      },
    },
  },
});

function mapRouteError(error: unknown): Response {
  if (error instanceof SpacesServiceError) {
    if (error.code === "space_not_found") {
      return errorResponse(404, error.code, error.message);
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
