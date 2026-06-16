import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const holdingsTable = pgTable("holdings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  shares: numeric("shares", { precision: 18, scale: 6 }).notNull().default("0"),
  avgCost: numeric("avg_cost", { precision: 18, scale: 6 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHoldingSchema = createInsertSchema(holdingsTable).omit({ id: true, updatedAt: true });
export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type Holding = typeof holdingsTable.$inferSelect;
