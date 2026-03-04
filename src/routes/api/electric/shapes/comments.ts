import { createFileRoute } from "@tanstack/react-router";
import { serveScopedShapeRoute } from "#/lib/electric-shape-route.server";

export const Route = createFileRoute("/api/electric/shapes/comments")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveScopedShapeRoute({
          request,
          table: "comments",
          scopeColumn: "space_id",
          columns: "id,post_id,space_id,author_id,body_rich_text,created_at,updated_at",
        }),
    },
  },
});
