import { createFileRoute } from "@tanstack/react-router";
import { serveScopedShapeRoute } from "#/lib/electric-shape-route.server";

export const Route = createFileRoute("/api/electric/shapes/posts")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveScopedShapeRoute({
          request,
          table: "posts",
          scopeColumn: "space_id",
          columns:
            "id,space_id,author_id,title,body_rich_text,image_url,image_meta,category_id,created_at,updated_at",
        }),
    },
  },
});
