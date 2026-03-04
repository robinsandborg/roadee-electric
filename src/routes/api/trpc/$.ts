import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "#/lib/auth";
import { postsRouter } from "#/lib/trpc/posts";
import { spacesRouter } from "#/lib/trpc/spaces";
import { router } from "#/lib/trpc";

export const appRouter = router({
  posts: postsRouter,
  spaces: spacesRouter,
});

export type AppRouter = typeof appRouter;

const serve = ({ request }: { request: Request }) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: async () => ({
      session: await auth.api.getSession({ headers: request.headers }),
    }),
  });
};

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: serve,
      POST: serve,
    },
  },
});
