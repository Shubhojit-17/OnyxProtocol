import { Router, Request, Response } from "express";
import { getDashboardOverview } from "../services/dashboard.service.js";
import { getPriceHistory } from "../services/price.service.js";

const router = Router();

// GET /api/dashboard/overview
router.get("/overview", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string | undefined;
    const period = (req.query.period as string) || "24h";
    const data = await getDashboardOverview(walletAddress, period);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/price-history?base=STRK&quote=oETH
router.get("/price-history", async (req: Request, res: Response) => {
  try {
    const base = (req.query.base as string) || "STRK";
    const quote = (req.query.quote as string) || "oETH";
    const data = await getPriceHistory(base, quote);
    res.json({ pair: `${base}/${quote}`, history: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
