import {
  Router,
  type IRouter,
  type Request,
  type Response as ExpressResponse,
} from "express";
import { Readable } from "node:stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import {
  ObjectStorageService,
  ObjectNotFoundError,
  type ObjectDownloadResponse,
} from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

type WildcardParam = string | string[] | undefined;

// Only image uploads are permitted. Validated against the client-declared
// contentType/size before a presigned URL is ever issued.
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

function getWildcardPath(raw: WildcardParam): string | null {
  const path = (Array.isArray(raw) ? raw.join("/") : raw ?? "").trim();
  return path.length > 0 ? path : null;
}

function sendStorageResponse(
  storageResponse: ObjectDownloadResponse,
  res: ExpressResponse,
): void {
  res.status(storageResponse.status);
  storageResponse.headers.forEach((value: string, key: string) =>
    res.setHeader(key, value),
  );

  if (!storageResponse.body) {
    res.end();
    return;
  }

  const nodeStream = Readable.fromWeb(storageResponse.body);
  nodeStream.pipe(res);
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post(
  "/storage/uploads/request-url",
  async (req: Request, res: ExpressResponse) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    const { name, size, contentType } = parsed.data;

    if (!ALLOWED_UPLOAD_MIME_TYPES.has(contentType.toLowerCase())) {
      res.status(400).json({
        error: `Unsupported file type "${contentType}". Allowed types: ${Array.from(
          ALLOWED_UPLOAD_MIME_TYPES,
        ).join(", ")}`,
      });
      return;
    }

    if (size > MAX_UPLOAD_SIZE_BYTES) {
      res.status(400).json({
        error: `File too large. Maximum size is ${
          MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
        } MB`,
      });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: ExpressResponse) => {
    try {
      const filePath = getWildcardPath(req.params.filePath);
      if (!filePath) {
        res.status(400).json({ error: "Missing file path" });
        return;
      }

      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const response = await objectStorageService.downloadObject(file);
      sendStorageResponse(response, res);
    } catch (error) {
      req.log.error({ err: error }, "Error serving public object");
      res.status(500).json({ error: "Failed to serve public object" });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get(
  "/storage/objects/*path",
  async (req: Request, res: ExpressResponse) => {
    try {
      // Private objects. Require authentication — the owner allowlist in
      // authMiddleware guarantees only the owner is ever authenticated, so
      // uploaded photos can't be fetched by anyone who obtains/guesses a URL.
      if (!req.isAuthenticated()) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const wildcardPath = getWildcardPath(req.params.path);
      if (!wildcardPath) {
        res.status(400).json({ error: "Missing object path" });
        return;
      }

      const objectPath = `/objects/${wildcardPath}`;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const response = await objectStorageService.downloadObject(objectFile);
      sendStorageResponse(response, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        req.log.warn({ err: error }, "Object not found");
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
