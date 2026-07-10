import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL or a Vercel Postgres URL env var must be set for database-backed routes.",
  );
}

function isLocalDatabase(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function getSslMode(url: string): string | null {
  try {
    return process.env.PGSSLMODE ?? new URL(url).searchParams.get("sslmode");
  } catch {
    return process.env.PGSSLMODE ?? null;
  }
}

function createPoolConfig(): pg.PoolConfig | undefined {
  if (!connectionString) {
    return undefined;
  }

  const sslMode = getSslMode(connectionString);
  const sslDisabled = sslMode === "disable" || isLocalDatabase(connectionString);
  if (sslDisabled) {
    return { connectionString };
  }

  return {
    connectionString,
    ssl: {
      rejectUnauthorized:
        process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
    },
  };
}

function createPool(): pg.Pool {
  try {
    return new Pool(createPoolConfig());
  } catch (error) {
    console.error(
      "Invalid database connection string; database-backed routes will fail until it is fixed.",
      error,
    );
    return new Pool();
  }
}

export const pool = createPool();
export const db = drizzle(pool, { schema });

export * from "./schema";
