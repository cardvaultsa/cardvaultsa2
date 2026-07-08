---
name: Phase 7 mobile patterns
description: Mobile UX decisions from Phase 7 — bottom nav, offline banner, backup reminder, lazy loading.
---

**Bottom nav (`src/components/bottom-nav.tsx`):**
- `lg:hidden` — only visible on mobile/tablet
- 4 primary items: Home, Cards, Sealed, Market + "More" button that opens the full sidebar drawer
- `env(safe-area-inset-bottom)` for iOS notch support
- Active state via `useRoute` (same as sidebar NavItem)
- Sidebar `NavItem` closes on click (`onNavigate={closeMobile}` callback)
- Main content has `pb-20 lg:pb-0` wrapper to avoid bottom nav overlap

**Offline banner (`src/components/offline-banner.tsx`):**
- `useOnlineStatus` hook wraps `navigator.onLine` + window online/offline events
- Shows amber warning when offline, green "Back online" for 3s after reconnect
- `useRef` for timer to avoid TS7030 "not all code paths return a value" in useEffect
- z-index `z-[60]` — above all other content including mobile header (z-30) and sidebar (z-50)

**Backup reminder (`src/hooks/use-backup-reminder.ts`):**
- `pokevault_first_seen_ts` — set on first load; reminder only fires after 7 days of first use
- `pokevault_last_backup_ts` — set by `markBackupDone()` (called from export-data.tsx on "Full Export")
- `pokevault_reminder_shown_ts` — daily cooldown so toast doesn't repeat on every page load
- 4-second delay after mount before checking (avoids toast on initial page paint)
- **Why first-seen grace period:** Without it, new users see "no backup on record" warning 4s after first login — perceived as an error.

**Lazy loading coverage:**
- `cards.tsx` — card list thumbnails
- `sealed.tsx` — sealed product list thumbnails
- `for-sale.tsx` — for-sale list thumbnails
- `market.tsx` — most valuable items thumbnails
- `image-gallery.tsx` — card/sealed detail photo grid
- layout.tsx — user profile avatar
- All use `loading="lazy" decoding="async"`

**Show-more pagination:**
- Cards and Sealed lists: `displayLimit = 50`, increments by 50 on button click
- Resets to 50 when search/sort/filter changes (via useEffect dependency on params)
- No API changes needed — full dataset fetched, sliced client-side
