import { Router, Request, Response } from "express";
import { getDashboardOverview } from "../services/dashboard.service.js";

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

export default router;
