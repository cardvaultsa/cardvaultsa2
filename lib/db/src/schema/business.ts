import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  date,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const expenseCategoryEnum = pgEnum("expense_category", [
  "supplies",
  "shipping",
  "platform_fees",
  "gas",
  "packaging",
  "grading",
  "purchase",
  "other",
]);

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  category: expenseCategoryEnum("category").notNull().default("other"),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  preferences: text("preferences"),
  notes: text("notes"),
  followUpDate: date("follow_up_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pickupStatusEnum = pgEnum("pickup_status", [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);

export const localPickupsTable = pgTable("local_pickups", {
  id: serial("id").primaryKey(),
  buyerName: text("buyer_name").notNull(),
  customerId: integer("customer_id"),
  location: text("location"),
  meetingDatetime: timestamp("meeting_datetime"),
  itemDescription: text("item_description"),
  amountDue: numeric("amount_due", { precision: 10, scale: 2 }),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }),
  status: pickupStatusEnum("status").notNull().default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;

export const insertCustomerSchema = createInsertSchema(customersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;

export const insertLocalPickupSchema = createInsertSchema(
  localPickupsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLocalPickup = z.infer<typeof insertLocalPickupSchema>;
export type LocalPickup = typeof localPickupsTable.$inferSelect;
