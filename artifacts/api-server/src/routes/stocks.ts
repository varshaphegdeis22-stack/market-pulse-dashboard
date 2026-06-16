import { Router } from "express";
import { SUPPORTED_STOCKS, getAllPrices } from "../lib/stockEngine";

const router = Router();

router.get("/stocks", (_req, res) => {
  res.json(SUPPORTED_STOCKS);
});

router.get("/stocks/prices", (_req, res) => {
  res.json(getAllPrices());
});

export default router;
