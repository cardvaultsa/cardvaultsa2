import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, expensesTable } from "@workspace/db";
import {
  ListExpensesQueryParams,
  CreateExpenseBody,
  GetExpenseParams,
  UpdateExpenseParams,
  UpdateExpenseBody,
  DeleteExpenseParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(e: typeof expensesTable.$inferSelect) {
  return { ...e, amount: Number(e.amount) };
}

router.get("/expenses", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const query = ListExpensesQueryParams.safeParse(req.query);
  const filters = query.success ? query.data : {};
  const conditions = [];
  if (filters.category)
    conditions.push(eq(expensesTable.category, filters.category as typeof expensesTable.$inferSelect["category"]));
  if (filters.dateFrom) conditions.push(gte(expensesTable.date, (filters.dateFrom instanceof Date ? filters.dateFrom.toISOString().slice(0, 10) : String(filters.dateFrom))));
  if (filters.dateTo) conditions.push(lte(expensesTable.date, (filters.dateTo instanceof Date ? filters.dateTo.toISOString().slice(0, 10) : String(filters.dateTo))));
  const rows = await db.select().from(expensesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`date desc, id desc`);
  res.json(rows.map(fmt));
});

router.post("/expenses", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount, date, ...restExpense } = parsed.data;
  const [row] = await db.insert(expensesTable).values({
    ...restExpense,
    amount: String(amount),
    date: date instanceof Date ? date.toISOString().slice(0, 10) : String(date),
  }).returning();
  res.status(201).json(fmt(row));
});

router.get("/expenses/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetExpenseParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(expensesTable).where(eq(expensesTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Expense not found" }); return; }
  res.json(fmt(row));
});

router.patch("/expenses/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = UpdateExpenseParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (amount !== undefined) updates.amount = String(amount);
  const [row] = await db.update(expensesTable).set(updates)
    .where(eq(expensesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Expense not found" }); return; }
  res.json(fmt(row));
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(expensesTable).where(eq(expensesTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Expense not found" }); return; }
  res.sendStatus(204);
});

export default router;
