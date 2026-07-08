---
name: Auth user null→undefined session bug
description: null optional profile fields become undefined in session JSON, causing Zod 500 on /api/auth/user
---

## Rule
When building `SessionData.user`, always use the DB value directly (or `?? null`), never `?? undefined`. Also normalize `undefined → null` in the `/auth/user` response handler before Zod parse.

**Why:** `JSON.stringify` silently drops `undefined` values. If a DB column (e.g. `profileImageUrl`) is `null` and you write `dbUser.profileImageUrl ?? undefined`, the value becomes `undefined`, gets stripped from the JSON stored in the sessions table, and comes back as a missing key. Any Zod schema that marks the field as required (even as `[string, 'null']`) then throws a 500. The frontend `useAuth` catch block interprets any non-ok response as "not logged in" → login page → infinite loop.

**How to apply:**
- In `createSession` (auth.ts): use `dbUser.xxx ?? null` for every nullable profile field.
- In `GET /api/auth/user`: normalize `rawUser.xxx ?? null` before passing to `GetCurrentAuthUserResponse.parse()` — this also fixes stale sessions already stored without those keys.
- In the OpenAPI `AuthUser` schema: only `id` should be in `required`; profile fields should be optional so the generated Zod schema accepts both null and undefined gracefully.
- In `AuthUser` interface (lib/auth.ts): type optional profile fields as `string | null` (not just `string`) so TS doesn't reject null assignments.
