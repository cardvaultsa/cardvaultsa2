import { spawn } from "node:child_process";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_PRISMA_URL;

if (!databaseUrl) {
  console.log("Skipping database schema push: no Postgres connection env var is set.");
  process.exit(0);
}

const child = spawn(
  "pnpm",
  ["--dir", "../../lib/db", "run", "push-force"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    console.warn(
      `Database schema push was interrupted by ${signal}; continuing deployment.`,
    );
    process.exit(0);
  }

  if (code && code !== 0) {
    console.warn(
      `Database schema push failed with exit code ${code}; continuing deployment. Auth tables will be initialized at runtime.`,
    );
    process.exit(0);
  }

  process.exit(0);
});
