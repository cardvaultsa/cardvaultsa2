---
name: Verifying auth / OIDC-gated code paths
description: How to exercise Replit-Auth-protected server paths without a real interactive login.
---

# Verifying auth / OIDC-gated paths (api-server)

Real interactive Replit-Auth (OIDC) login can't be scripted from the agent, so use these techniques.

## Forge a session directly in Postgres
Sessions live in the `sessions` table: columns `sid` (pk), `sess` (jsonb), `expire` (timestamp).
Insert a row where `sess = {"user":{"id":"<id>"},"access_token":"test","expires_at":<far-future EPOCH SECONDS>}` and `expire` is a future timestamp.
- `authMiddleware` validates the row via `expire`, and `refreshIfExpired` reads `sess.expires_at` (seconds) — set it far in the future so no token refresh is attempted.
- Set `sess.user.id` == `ALLOWED_USER_ID` for an owner session, or a different id for a non-owner (triggers the blocked path).
- The middleware/logout call `clearSession`, which DELETEs the row — forged sessions are self-cleaning on the deny/logout paths. Don't delete the one real owner session.
Then `curl -H "Cookie: sid=<sid>"` through the shared proxy (`localhost:80`) and read the workflow logs.

## OIDC-callback-only paths
The `/api/callback` success (and callback-side reject) run only after `oidc.authorizationCodeGrant` succeeds against the real IdP — unreachable via curl. To verify logic that only fires there (e.g. an audit/log emit), invoke the shared helper in isolation:
- Bundle a tiny script with the artifact's esbuild in **CJS** (`--format=cjs`). ESM bundling fails with `Dynamic require of "node:os"` because pino uses `require`.

## pino-pretty hides custom top-level fields
In dev (pino-pretty transport) extra top-level log fields like a custom `timestamp` are NOT rendered, but they ARE present in the raw JSON emitted in production. pino's built-in `time` is the always-present timestamp (shown as the `[HH:MM:SS]` prefix in pretty mode).
