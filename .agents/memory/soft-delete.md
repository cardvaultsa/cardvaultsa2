---
name: Soft-delete & recycle bin
description: How the deleted_at column pattern is implemented in PokéVault; trash/restore route behavior; image lifecycle.
---

## Rule
All DELETE operations on cards and sealed products set `deleted_at = NOW()` rather than hard-deleting the row. All SELECT queries must filter `WHERE deleted_at IS NULL`.

**Why:** Prevents accidental permanent data loss. The recycle bin (`/api/trash`) lets the owner review and restore before committing.

**How to apply:**
- `cards.ts` and `sealedProducts.ts` DELETE routes: `db.update(...).set({ deletedAt: new Date() })`.
- All list/detail routes in cards, sealedProducts, dashboard, listing, exportData: add `isNull(cardsTable.deletedAt)` to the where clause.
- Trash routes live in `trash.ts`: GET (list deleted), POST /:id/restore (set deletedAt = null), DELETE /:id (hard-delete, final).

## Image lifecycle
- Images (`item_images`) are **never** touched by the soft-delete. They stay linked to the card/sealed product row.
- On hard-delete from trash, `item_images` rows are deleted from the DB, but the corresponding GCS object files are **not** deleted. This leaves orphaned files in object storage — known limitation, acceptable for single-owner private app.
