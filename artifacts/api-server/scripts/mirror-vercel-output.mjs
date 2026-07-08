import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const serverRoot = path.resolve(import.meta.dirname, "..");
const primaryOutput = path.join(serverRoot, "dist", "public");
const compatibilityOutput = path.join(
  serverRoot,
  "artifacts",
  "pokedex-vault",
  "dist",
  "public",
);

await rm(compatibilityOutput, { recursive: true, force: true });
await mkdir(path.dirname(compatibilityOutput), { recursive: true });
await cp(primaryOutput, compatibilityOutput, { recursive: true });

await writeFile(
  path.join(primaryOutput, "server.mjs"),
  `import express from "express";
import app from "../app.mjs";

void express;

export default app;
`,
);
