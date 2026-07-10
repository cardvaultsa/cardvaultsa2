import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const serverRoot = path.resolve(import.meta.dirname, "..");
const primaryOutput = path.join(serverRoot, "dist", "public");
const serverBundleFiles = [
  "app.mjs",
  "pino-worker.mjs",
  "pino-file.mjs",
  "pino-pretty.mjs",
  "thread-stream-worker.mjs",
];
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

for (const file of serverBundleFiles) {
  await cp(path.join(serverRoot, "dist", file), path.join(primaryOutput, file));
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function collectStaticAssets(dir, root = dir) {
  const assets = [];
  for (const entry of await readdir(dir)) {
    const absolute = path.join(dir, entry);
    const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
    const entryStat = await stat(absolute);

    if (entryStat.isDirectory()) {
      assets.push(...await collectStaticAssets(absolute, root));
      continue;
    }

    if (serverBundleFiles.includes(relative) || relative === "server.mjs") {
      continue;
    }

    const extension = path.extname(relative);
    assets.push([
      `/${relative}`,
      {
        contentType: mimeTypes[extension] ?? "application/octet-stream",
        data: (await readFile(absolute)).toString("base64"),
      },
    ]);
  }
  return assets;
}

const staticAssets = await collectStaticAssets(primaryOutput);

await writeFile(
  path.join(primaryOutput, "server.mjs"),
  `import express from "express";
import app from "./app.mjs";

const staticAssets = new Map(${JSON.stringify(staticAssets)});
const server = express();

function normalizePath(url) {
  try {
    return decodeURIComponent(new URL(url, "https://local.invalid").pathname);
  } catch {
    return "/";
  }
}

server.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }

  const pathname = normalizePath(req.url);
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    next();
    return;
  }

  const asset =
    staticAssets.get(pathname) ??
    staticAssets.get(pathname.endsWith("/") ? pathname + "index.html" : pathname + "/index.html") ??
    staticAssets.get("/index.html");

  if (!asset) {
    next();
    return;
  }

  res.setHeader("Content-Type", asset.contentType);
  res.setHeader(
    "Cache-Control",
    pathname === "/" || pathname.endsWith(".html")
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  );
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(Buffer.from(asset.data, "base64"));
});

server.use(app);

export default server;
`,
);
