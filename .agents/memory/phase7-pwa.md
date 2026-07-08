---
name: Phase 7 PWA setup
description: How vite-plugin-pwa is configured for the PokéVault frontend — dev/prod separation, workbox caching strategies.
---

vite-plugin-pwa is installed in `@workspace/pokedex-vault` as a devDependency.

**Key decisions:**

- `devOptions: { enabled: false }` — service worker is intentionally disabled in development. It only activates on production builds. This avoids stale cache confusion during dev.
- SVG icons at `public/icons/pwa-192.svg` and `public/icons/pwa-512.svg` — pokeball design on dark background. Not PNGs (no build tooling for that). Works on Android Chrome; iOS requires PNG for full splash screen.
- `start_url: "/"` — correct since `BASE_PATH="/"` in artifact.toml for both dev and production.
- **Workbox runtime caching strategies:**
  - `/api/(not auth)` → `NetworkFirst`, 8s timeout, 200-entry cache, 24h TTL — serves cached data when offline
  - `/api/storage/*` → `CacheFirst`, 500-entry cache, 7d TTL — immutable photo assets, never re-fetched
  - `/api/auth/*` → **NOT cached** (excluded by regex) — prevents caching session tokens
- `registerType: "autoUpdate"` — app updates silently in background

**Why:** NetworkFirst for API calls means fresh data when online, graceful cached fallback when offline. CacheFirst for images means photos load instantly from cache (immutable GCS objects).

**How to apply:** Any future API routes that should NOT be cached offline should be added to the auth exclusion pattern.
