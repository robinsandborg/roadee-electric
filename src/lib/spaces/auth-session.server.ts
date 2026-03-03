import { auth } from "#/lib/auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export async function requireSessionUser(request: Request): Promise<SessionUser> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };
}
