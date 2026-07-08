---
name: PokéVault security model
description: Durable auth/security decisions for the api-server (single-owner private app).
---

# Security model (api-server)

Single-owner private app. Only the one owner Replit account should ever be authenticated.

## Owner allowlist (ALLOWED_USER_ID)
Enforced in BOTH `authMiddleware` (defense-in-depth for pre-existing sessions incl. Bearer) AND the OIDC callback in `routes/auth.ts` (reject before session/DB write). Keep both.

**Fail behavior when the env var is unset:** fail OPEN in development (so you're never locked out while iterating), fail CLOSED in production (deny all authenticated access). A startup warning is logged when it's unset.
**Why:** a missing prod config must never silently reopen the app to any Replit user — that's the exact hole this control closes.

## Private object route (`GET /api/storage/objects/*`)
Gated by a plain `req.isAuthenticated()` check only — NOT the ACL `canAccessObjectEntity` check.
**Why:** uploads never call `trySetObjectEntityAclPolicy`, so objects have no ACL policy; `canAccessObject` would return false and block even the owner. For a single-owner app, isAuthenticated is the correct gate (the owner allowlist already guarantees only the owner is authenticated). Same-origin `<img>` tags send the session cookie, so the gallery keeps working.

## Presigned upload URL validation
MIME allowlist + max size are validated only against the CLIENT-DECLARED contentType/size on `POST /api/storage/uploads/request-url`.
**Why:** the Replit object-storage sidecar signing API cannot embed content-type/size conditions into the signed PUT, so GCS can't enforce them. Residual risk is low because the endpoint requires auth and the only authenticated principal is the owner.

## Other
- `app.set("trust proxy", 1)` — exactly one hop (Replit's proxy), so `req.ip` for rate limiting is not X-Forwarded-For spoofable. Do not use `true` (spoofable).
- Rate limiters use in-memory store — per-instance if the deploy ever autoscales. Fine for single-owner.
- Global error handler honors `err.status`/`err.statusCode` for 4xx (e.g. malformed JSON → 400) but returns a generic 500 for everything else (no internals leaked).
