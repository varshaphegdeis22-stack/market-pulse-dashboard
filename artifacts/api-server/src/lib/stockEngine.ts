import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";
import { logger } from "./logger";

export const SUPPORTED_STOCKS = [
  { ticker: "GOOG", name: "Alphabet Inc." },
  { ticker: "TSLA", name: "Tesla Inc." },
  { ticker: "AMZN", name: "Amazon.com Inc." },
  { ticker: "META", name: "Meta Platforms Inc." },
  { ticker: "NVDA", name: "NVIDIA Corporation" },
];

interface StockPrice {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "neutral";
}

const BASE_PRICES: Record<string, number> = {
  GOOG: 175.0,
  TSLA: 250.0,
  AMZN: 200.0,
  META: 550.0,
  NVDA: 130.0,
};

const currentPrices: Record<string, StockPrice> = {};

// Initialize prices
for (const stock of SUPPORTED_STOCKS) {
  const base = BASE_PRICES[stock.ticker]!;
  currentPrices[stock.ticker] = {
    ticker: stock.ticker,
    price: base,
    change: 0,
    changePercent: 0,
    trend: "neutral",
  };
}

function updatePrice(ticker: string): StockPrice {
  const current = currentPrices[ticker]!;
  const base = BASE_PRICES[ticker]!;
  // Random walk: up to ±0.5% per tick
  const delta = (Math.random() - 0.5) * 0.01 * current.price;
  const newPrice = Math.max(0.01, current.price + delta);
  const change = newPrice - base;
  const changePercent = (change / base) * 100;
  const trend = delta > 0.001 ? "up" : delta < -0.001 ? "down" : "neutral";

  currentPrices[ticker] = {
    ticker,
    price: Math.round(newPrice * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    trend,
  };

  return currentPrices[ticker]!;
}

export function getAllPrices(): StockPrice[] {
  return Object.values(currentPrices);
}

export function getPrice(ticker: string): StockPrice | undefined {
  return currentPrices[ticker];
}

let wss: WebSocketServer | null = null;

export function setupWebSocketServer(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ url: req.url }, "WebSocket client connected");

    ws.on("close", () => {
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });

    // Send current prices immediately on connect
    const prices = getAllPrices();
    if (ws.readyState === WebSocket.OPEN) {
      for (const price of prices) {
        ws.send(JSON.stringify(price));
      }
    }
  });

  // Broadcast updated prices every second
  setInterval(() => {
    if (!wss) return;

    for (const stock of SUPPORTED_STOCKS) {
      const updated = updatePrice(stock.ticker);
      const message = JSON.stringify(updated);

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }, 1000);

  logger.info("WebSocket server initialized at /ws");
}
