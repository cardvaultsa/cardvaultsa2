import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, localPickupsTable } from "@workspace/db";
import {
  ListPickupsQueryParams,
  CreatePickupBody,
  GetPickupParams,
  UpdatePickupParams,
  UpdatePickupBody,
  DeletePickupParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(p: typeof localPickupsTable.$inferSelect) {
  return {
    ...p,
    amountDue: p.amountDue != null ? Number(p.amountDue) : null,
    amountPaid: p.amountPaid != null ? Number(p.amountPaid) : null,
  };
}

router.get("/pickups", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const query = ListPickupsQueryParams.safeParse(req.query);
  const filters = query.success ? query.data : {};
  const rows = await db.select().from(localPickupsTable)
    .where(
      filters.status
        ? eq(localPickupsTable.status, filters.status as typeof localPickupsTable.$inferSelect["status"])
        : undefined
    )
    .orderBy(sql`meeting_datetime asc nulls last, id desc`);
  res.json(rows.map(fmt));
});

router.post("/pickups", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreatePickupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amountDue, amountPaid, ...rest } = parsed.data;
  const [row] = await db.insert(localPickupsTable).values({
    ...rest,
    amountDue: amountDue != null ? String(amountDue) : null,
    amountPaid: amountPaid != null ? String(amountPaid) : null,
  }).returning();
  res.status(201).json(fmt(row));
});

router.get("/pickups/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetPickupParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(localPickupsTable).where(eq(localPickupsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Pickup not found" }); return; }
  res.json(fmt(row));
});

router.patch("/pickups/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = UpdatePickupParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePickupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amountDue, amountPaid, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (amountDue !== undefined) updates.amountDue = amountDue != null ? String(amountDue) : null;
  if (amountPaid !== undefined) updates.amountPaid = amountPaid != null ? String(amountPaid) : null;
  const [row] = await db.update(localPickupsTable).set(updates)
    .where(eq(localPickupsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Pickup not found" }); return; }
  res.json(fmt(row));
});

router.delete("/pickups/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeletePickupParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(localPickupsTable).where(eq(localPickupsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Pickup not found" }); return; }
  res.sendStatus(204);
});

export default router;
