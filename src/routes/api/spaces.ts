import { createFileRoute } from "@tanstack/react-router";
import { normalizeSpaceSlug } from "#/lib/space-slug";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";
import { SpacesServiceError } from "#/lib/spaces/service";
import {
  createSpaceWithOwnerInDb,
  listVisibleStateForUserFromDb,
} from "#/lib/spaces/repository.server";

export const Route = createFileRoute("/api/spaces")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireSessionUser(request);
          const visibleState = await listVisibleStateForUserFromDb(user.id);
          return Response.json(visibleState, { status: 200 });
        } catch (error) {
          return mapRouteError(error);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireSessionUser(request);
          const payload = await parseJsonBody(request);

          const name = String(payload.name ?? "").trim();
          const description = String(payload.description ?? "").trim();
          const slug = normalizeSpaceSlug(String(payload.slug ?? ""));

          if (!name || !description || !slug) {
            return errorResponse(400, "invalid_input", "Name, slug, and description are required.");
          }

          const result = await createSpaceWithOwnerInDb({
            id: typeof payload.id === "string" ? payload.id : undefined,
            ownerMembershipId:
              typeof payload.ownerMembershipId === "string" ? payload.ownerMembershipId : undefined,
            name,
            slug,
            description,
            createdBy: user.id,
          });

          return Response.json(result, { status: 201 });
        } catch (error) {
          return mapRouteError(error);
        }
      },
    },
  },
});

function mapRouteError(error: unknown): Response {
  if (error instanceof SpacesServiceError) {
    if (error.code === "slug_conflict") {
      return errorResponse(409, error.code, error.message);
    }
    if (error.code === "invalid_slug") {
      return errorResponse(400, error.code, error.message);
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
