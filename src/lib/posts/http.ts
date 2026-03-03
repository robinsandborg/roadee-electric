import { PostsServiceError } from "#/lib/posts/service";

export function mapPostsRouteError(error: unknown): Response {
  if (error instanceof PostsServiceError) {
    switch (error.code) {
      case "space_not_found":
      case "post_not_found":
        return errorResponse(404, error.code, error.message);
      case "membership_required":
      case "forbidden":
        return errorResponse(403, error.code, error.message);
      case "invalid_input":
      case "invalid_category_scope":
      case "invalid_tag_scope":
        return errorResponse(422, error.code, error.message);
      case "conflict":
        return errorResponse(409, error.code, error.message);
    }
  }

  if (error instanceof Error && error.message === "Unauthorized") {
    return errorResponse(401, "unauthorized", "Authentication required.");
  }

  return errorResponse(500, "unknown_error", "Unexpected error.");
}

export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
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

export function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ code, message }, { status });
}
