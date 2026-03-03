import { describe, expect, it } from "vitest";
import { mapPostsRouteError } from "#/lib/posts/http";
import { PostsServiceError } from "#/lib/posts/service";

describe("mapPostsRouteError", () => {
  it("maps forbidden to 403", async () => {
    const response = mapPostsRouteError(new PostsServiceError("forbidden", "Forbidden"));
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(payload.code).toBe("forbidden");
  });

  it("maps invalid taxonomy scope to 422", async () => {
    const response = mapPostsRouteError(
      new PostsServiceError("invalid_category_scope", "Invalid category"),
    );
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(422);
    expect(payload.code).toBe("invalid_category_scope");
  });
});
