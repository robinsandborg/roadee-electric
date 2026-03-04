import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "#/lib/auth";

type TrpcContext = {
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
};

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
const procedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      session: ctx.session,
    },
  });
});

export const authedProcedure = procedure.use(isAuthed);
