import { Router } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { SUPPORTED_STOCKS } from "../lib/stockEngine";
import { logger } from "../lib/logger";

const router = Router();

const VALID_TICKERS = new Set(SUPPORTED_STOCKS.map((s) => s.ticker));

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any).userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/subscriptions", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId as number;
  try {
    const subs = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    res.json(
      subs.map((s) => ({
        id: s.id,
        userId: s.userId,
        ticker: s.ticker,
        createdAt: s.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "List subscriptions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/subscriptions", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId as number;
  const { ticker } = req.body ?? {};

  if (!ticker || !VALID_TICKERS.has(ticker)) {
    res.status(400).json({ error: "Invalid or unsupported ticker" });
    return;
  }

  try {
    // Prevent duplicates
    const existing = await db
      .select()
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.ticker, ticker)))
      .then((r) => r[0]);

    if (existing) {
      res.status(400).json({ error: "Already subscribed" });
      return;
    }

    const [sub] = await db.insert(subscriptionsTable).values({ userId, ticker }).returning();
    res.status(201).json({
      id: sub!.id,
      userId: sub!.userId,
      ticker: sub!.ticker,
      createdAt: sub!.createdAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Create subscription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/subscriptions/:ticker", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId as number;
  const { ticker } = req.params;

  try {
    const deleted = await db
      .delete(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.ticker, ticker)))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Subscription not found" });
      return;
    }

    res.json({ message: "Unsubscribed" });
  } catch (err) {
    logger.error({ err }, "Delete subscription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
