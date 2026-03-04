import { redirect } from "@tanstack/react-router";
import { authClient, authStateCollection } from "#/lib/auth-client";

export async function requireSessionBeforeLoad(redirectTo = "/") {
  const cached = authStateCollection.get("auth");
  if (cached?.session?.expiresAt && new Date(cached.session.expiresAt) > new Date()) {
    return cached;
  }

  const result = await authClient.getSession();
  const next = {
    id: "auth",
    session: result.data?.session ?? null,
    user: result.data?.user ?? null,
  };

  try {
    authStateCollection.insert(next);
  } catch {
    authStateCollection.update("auth", (draft) => {
      draft.session = next.session;
      draft.user = next.user;
    });
  }

  if (!result.data?.session) {
    throw redirect({
      to: redirectTo,
    });
  }

  return result.data;
}
