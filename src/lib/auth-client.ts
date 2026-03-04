import { createAuthClient } from "better-auth/react";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { z } from "zod";

const AuthStateSchema = z.object({
  id: z.string(),
  session: z.any().nullable(),
  user: z.any().nullable(),
});

export const authStateCollection = createCollection(
  localOnlyCollectionOptions({
    id: "auth-state",
    getKey: (item) => item.id,
    schema: AuthStateSchema,
  }),
);

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
});
