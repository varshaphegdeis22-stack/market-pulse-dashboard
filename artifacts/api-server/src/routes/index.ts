import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import stocksRouter from "./stocks";
import subscriptionsRouter from "./subscriptions";
import portfolioRouter from "./portfolio";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(stocksRouter);
router.use(subscriptionsRouter);
router.use(portfolioRouter);

export default router;
