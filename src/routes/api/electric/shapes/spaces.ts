import { createFileRoute } from "@tanstack/react-router";
import { serveScopedShapeRoute } from "#/lib/electric-shape-route.server";

export const Route = createFileRoute("/api/electric/shapes/spaces")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveScopedShapeRoute({
          request,
          table: "spaces",
          scopeColumn: "id",
          columns: "id,slug,name,description,created_by,created_at,updated_at",
          allowPublicBySlug: true,
        }),
    },
  },
});
