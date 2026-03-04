import { createFileRoute } from "@tanstack/react-router";
import { serveScopedShapeRoute } from "#/lib/electric-shape-route.server";

export const Route = createFileRoute("/api/electric/shapes/post-tags")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveScopedShapeRoute({
          request,
          table: "post_tags",
          scopeColumn: "space_id",
          columns: "id,post_id,tag_id,space_id",
        }),
    },
  },
});
