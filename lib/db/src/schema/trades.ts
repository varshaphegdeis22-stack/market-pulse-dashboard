import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  type: text("type").notNull(),
  shares: numeric("shares", { precision: 18, scale: 6 }).notNull(),
  price: numeric("price", { precision: 18, scale: 6 }).notNull(),
  total: numeric("total", { precision: 18, scale: 6 }).notNull(),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, executedAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
