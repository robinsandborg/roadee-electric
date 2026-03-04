import { createFileRoute } from "@tanstack/react-router";
import { serveScopedShapeRoute } from "#/lib/electric-shape-route.server";

export const Route = createFileRoute("/api/electric/shapes/memberships")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveScopedShapeRoute({
          request,
          table: "memberships",
          scopeColumn: "space_id",
          columns: "id,space_id,user_id,role,title,created_at,updated_at",
        }),
    },
  },
});
