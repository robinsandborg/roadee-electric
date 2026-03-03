import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __ROADEE_PG_POOL__: Pool | undefined;
}

export function getPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!globalThis.__ROADEE_PG_POOL__) {
    globalThis.__ROADEE_PG_POOL__ = new Pool({
      connectionString,
    });
  }

  return globalThis.__ROADEE_PG_POOL__;
}
