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

function createPool(): pg.Pool {
  try {
    return new Pool(
      connectionString ? { connectionString } : undefined,
    );
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
