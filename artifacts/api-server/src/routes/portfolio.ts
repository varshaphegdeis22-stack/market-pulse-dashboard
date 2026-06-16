import { Router } from "express";
import { db, holdingsTable, tradesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { SUPPORTED_STOCKS, getPrice } from "../lib/stockEngine";
import { logger } from "../lib/logger";
import { z } from "zod/v4";

const router = Router();

const VALID_TICKERS = new Set(SUPPORTED_STOCKS.map((s) => s.ticker));

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any).userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/portfolio", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId as number;
  try {
    const holdings = await db
      .select()
      .from(holdingsTable)
      .where(eq(holdingsTable.userId, userId));

    const activeHoldings = holdings.filter((h) => parseFloat(h.shares) > 0);

    let totalValue = 0;
    let totalCost = 0;

    const enriched = activeHoldings.map((h) => {
      const priceData = getPrice(h.ticker);
      const currentPrice = priceData?.price ?? 0;
      const shares = parseFloat(h.shares);
      const avgCost = parseFloat(h.avgCost);
      const totalVal = shares * currentPrice;
      const totalC = shares * avgCost;
      const pnl = totalVal - totalC;
      const pnlPercent = totalC > 0 ? (pnl / totalC) * 100 : 0;

      totalValue += totalVal;
      totalCost += totalC;

      return {
        ticker: h.ticker,
        shares,
        avgCost,
        currentPrice,
        totalCost: Math.round(totalC * 100) / 100,
        totalValue: Math.round(totalVal * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
      };
    });

    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    res.json({
      holdings: enriched,
      totalValue: Math.round(totalValue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      totalPnlPercent: Math.round(totalPnlPercent * 100) / 100,
    });
  } catch (err) {
    logger.error({ err }, "Get portfolio error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/trades", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId as number;
  try {
    const trades = await db
      .select()
      .from(tradesTable)
      .where(eq(tradesTable.userId, userId))
      .orderBy(tradesTable.executedAt);

    res.json(
      trades.map((t) => ({
        id: t.id,
        ticker: t.ticker,
        type: t.type,
        shares: parseFloat(t.shares),
        price: parseFloat(t.price),
        total: parseFloat(t.total),
        executedAt: t.executedAt.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "List trades error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const tradeSchema = z.object({
  ticker: z.string(),
  type: z.enum(["buy", "sell"]),
  shares: z.number().positive(),
});

router.post("/trades", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId as number;
  const parsed = tradeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid trade input" });
    return;
  }

  const { ticker, type, shares } = parsed.data;

  if (!VALID_TICKERS.has(ticker)) {
    res.status(400).json({ error: "Unsupported ticker" });
    return;
  }

  const priceData = getPrice(ticker);
  if (!priceData) {
    res.status(400).json({ error: "Price not available" });
    return;
  }

  const price = priceData.price;
  const total = Math.round(shares * price * 100) / 100;

  try {
    const existing = await db
      .select()
      .from(holdingsTable)
      .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.ticker, ticker)))
      .then((r) => r[0]);

    if (type === "sell") {
      const currentShares = existing ? parseFloat(existing.shares) : 0;
      if (currentShares < shares) {
        res.status(400).json({ error: `Insufficient shares. You hold ${currentShares.toFixed(4)} shares.` });
        return;
      }

      const newShares = currentShares - shares;
      if (newShares < 0.0001) {
        await db
          .delete(holdingsTable)
          .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.ticker, ticker)));
      } else {
        await db
          .update(holdingsTable)
          .set({ shares: newShares.toString() })
          .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.ticker, ticker)));
      }
    } else {
      // buy
      if (existing) {
        const prevShares = parseFloat(existing.shares);
        const prevAvg = parseFloat(existing.avgCost);
        const newShares = prevShares + shares;
        const newAvg = (prevShares * prevAvg + shares * price) / newShares;

        await db
          .update(holdingsTable)
          .set({
            shares: newShares.toString(),
            avgCost: newAvg.toString(),
          })
          .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.ticker, ticker)));
      } else {
        await db.insert(holdingsTable).values({
          userId,
          ticker,
          shares: shares.toString(),
          avgCost: price.toString(),
        });
      }
    }

    const [trade] = await db
      .insert(tradesTable)
      .values({
        userId,
        ticker,
        type,
        shares: shares.toString(),
        price: price.toString(),
        total: total.toString(),
      })
      .returning();

    res.status(201).json({
      id: trade!.id,
      ticker: trade!.ticker,
      type: trade!.type,
      shares: parseFloat(trade!.shares),
      price: parseFloat(trade!.price),
      total: parseFloat(trade!.total),
      executedAt: trade!.executedAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Execute trade error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
