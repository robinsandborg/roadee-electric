import { createFileRoute } from "@tanstack/react-router";
import { serveScopedShapeRoute } from "#/lib/electric-shape-route.server";

export const Route = createFileRoute("/api/electric/shapes/post-upvotes")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveScopedShapeRoute({
          request,
          table: "post_upvotes",
          scopeColumn: "space_id",
          columns: "id,post_id,space_id,user_id,created_at",
        }),
    },
  },
});
