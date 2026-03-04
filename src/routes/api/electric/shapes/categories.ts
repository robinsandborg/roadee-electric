import { createFileRoute } from "@tanstack/react-router";
import { serveScopedShapeRoute } from "#/lib/electric-shape-route.server";

export const Route = createFileRoute("/api/electric/shapes/categories")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveScopedShapeRoute({
          request,
          table: "categories",
          scopeColumn: "space_id",
          columns: "id,space_id,name,kind,created_at",
          allowPublicBySlug: true,
        }),
    },
  },
});
