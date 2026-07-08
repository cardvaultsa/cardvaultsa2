---
name: Backup/restore atomicity
description: How the backup/restore endpoint is implemented; why the transaction and sequence reset are separated.
---

## Rule
The POST `/api/backup/restore` restore loop **must** run inside `db.transaction()`. Sequence resets run **outside** the transaction.

**Why:** If any upsert fails mid-loop without a transaction, the DB is left in a partial state (some records restored, others not). PG sequences are not transactional — `setval()` is always visible immediately regardless of transaction state, so it belongs outside.

**How to apply:**
```ts
await db.transaction(async (tx) => {
  for (const c of cards) {
    await tx.insert(cardsTable).values(row).onConflictDoUpdate({ target: cardsTable.id, set: {...} });
    for (const img of c.images ?? []) {
      await tx.insert(itemImagesTable).values({...}).onConflictDoUpdate({...});
    }
  }
  // sealed products + images similar
});
// After the transaction:
await pool.query("SELECT setval('cards_id_seq', COALESCE((SELECT MAX(id) FROM cards), 0))");
```

## Backup scope
Snapshot covers `cards`, `sealed_products`, `item_images` only. Expenses, customers, pickups are not included — known limitation for Phase 2.

## Image storage note
The `objectPath` field persists in the DB. GCS objects survive restores as long as the bucket exists. The snapshot JSON includes a `storageNote` explaining this to users.
