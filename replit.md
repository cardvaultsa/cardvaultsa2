# PokéVault

A private, login-protected Pokémon card collection and resale tracker. The owner logs in to manage card/sealed product inventory, track purchases/sales, view profit/loss, upload multiple photos per item, browse a gallery view, generate FB Marketplace-style listing descriptions, and see a dashboard summary. No public pages.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/pokedex-vault run dev` — run the frontend (port 26020)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 + Wouter + TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Replit Auth (OIDC/PKCE) — `lib/replit-auth-web` (useAuth hook)
- Storage: Replit Object Storage (GCS presigned URLs) — `lib/object-storage-web` (custom file uploader)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle for API server)

## Where things live

- `lib/api-spec/openapi.yaml` — Source of truth for all API contracts
- `lib/api-client-react/src/generated/` — Generated React Query hooks + Zod schemas (do not edit manually)
- `lib/db/src/schema/` — DB schema: `auth.ts` (users/sessions), `cards.ts` (cards, sealed products, item images), `business.ts` (expenses, customers, pickups), `market.ts` (priceSnapshots, collectionValueHistory)
- `lib/replit-auth-web/src/` — `useAuth()` hook for frontend auth
- `lib/object-storage-web/src/` — ObjectUploader component (unused — replaced with custom fetch uploader)
- `artifacts/api-server/src/routes/` — Express routes: auth, cards, sealedProducts, images, dashboard, listing, storage, market
- `artifacts/pokedex-vault/src/pages/` — Frontend pages: dashboard, cards, card-detail, sealed, sealed-detail, listing, market
- `artifacts/pokedex-vault/src/components/` — layout, photo-uploader, image-gallery, ui/*

## Architecture decisions

- Contract-first API design: OpenAPI spec defines all routes, Orval generates typed React Query hooks + Zod validators
- All routes require authentication (401 if not logged in), enforced via `authMiddleware` in Express
- Photo uploads use presigned PUT URLs (GCS via Replit Object Storage): client calls `/api/storage/uploads/request-url`, then PUTs directly to GCS
- Uppy v5 was evaluated but its API changed significantly in v5 (no Dashboard from @uppy/react, S3 plugin is multipart-only). Replaced with a simple custom file input + fetch uploader
- `pnpm overrides` pins react/react-dom to 19.1.0 to avoid peer conflicts across packages

## Product

- **Dashboard**: Summary stats (total items, cost, market value, profit, sold/for-sale counts) + recent activity feed
- **Cards inventory**: Searchable/filterable list with cover thumbnails, click-through to detail
- **Card detail**: All fields, photo gallery with label badges (front/back/damage/receipt/sealed/other), photo upload, FB Marketplace listing generator, edit/delete
- **Sealed products**: Same pattern as cards but for ETBs, booster boxes, tins, etc.
- **Listing generator**: Pick any card or sealed product, generate a Facebook Marketplace description, copy to clipboard
- **Market** (`/market`): Portfolio value tracking — 30-day Recharts line chart, period changes (1d/7d/30d), most valuable items, biggest gainers/losers (7-day), cost basis vs market value. Save Snapshot records today's value; Refresh Prices fetches Pokemon TCG API prices + auto-snapshots.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change before editing frontend code
- Run `pnpm --filter @workspace/db run push` after any schema changes (dev only)
- Query key helper functions from Orval are named `getXxxQueryKey()` NOT `useGetXxxQueryKey()`
- UseQueryOptions requires `queryKey` to be passed when using `enabled` — use `getXxxQueryKey()` helper
- `pnpm overrides` uses `"19.1.0"` (literal version) not `"$react"` — root package.json doesn't have react as a direct dep

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
