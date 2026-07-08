---
name: Collection route ordering
description: Why collectionRouter must be registered before cardsRouter in Express
---

## Rule
Register `collectionRouter` before `cardsRouter` in `artifacts/api-server/src/routes/index.ts`.

**Why:** Express evaluates routers in registration order. `GET /cards/duplicates` in `collectionRouter` would be swallowed by `GET /cards/:id` in `cardsRouter` (id = "duplicates"), returning 400 instead of the correct response.

**How to apply:** Any future route under `/cards/<static-segment>` that lives in a separate router must be registered before `cardsRouter`. Alternatively, add it directly to `cardsRouter` *before* the `/:id` handler.
