import { Router, type IRouter } from "express";
import { eq, or, ilike, sql } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import {
  ListCustomersQueryParams,
  CreateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  UpdateCustomerBody,
  DeleteCustomerParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/customers", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const query = ListCustomersQueryParams.safeParse(req.query);
  const filters = query.success ? query.data : {};
  const rows = await db.select().from(customersTable)
    .where(
      filters.search
        ? or(
            ilike(customersTable.name, `%${filters.search}%`),
            ilike(customersTable.phone ?? sql`''`, `%${filters.search}%`),
            ilike(customersTable.email ?? sql`''`, `%${filters.search}%`),
          )
        : undefined
    )
    .orderBy(customersTable.name);
  res.json(rows);
});

router.post("/customers", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { followUpDate, ...restCustomer } = parsed.data;
  const [row] = await db.insert(customersTable).values({
    ...restCustomer,
    followUpDate: followUpDate instanceof Date ? followUpDate.toISOString().slice(0, 10) : (followUpDate ?? null),
  }).returning();
  res.status(201).json(row);
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(row);
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { followUpDate: fud, ...restUpd } = parsed.data;
  const [row] = await db.update(customersTable)
    .set({
      ...restUpd,
      ...(fud !== undefined ? { followUpDate: fud instanceof Date ? fud.toISOString().slice(0, 10) : fud } : {}),
      updatedAt: new Date(),
    })
    .where(eq(customersTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(row);
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(customersTable).where(eq(customersTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Customer not found" }); return; }
  res.sendStatus(204);
});

export default router;
