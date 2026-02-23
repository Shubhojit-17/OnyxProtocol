import { Router, Request, Response } from "express";
import {
  getTradeHistorySummary,
  exportTradeHistory,
} from "../services/history.service.js";

const router = Router();

// GET /api/history/trades?walletAddress=...
router.get("/trades", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress required" });
      return;
    }

    const data = await getTradeHistorySummary(walletAddress);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/history/export?walletAddress=...&format=csv|pdf
router.get("/export", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    const format = (req.query.format as string) || "csv";

    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress required" });
      return;
    }

    const result = await exportTradeHistory(walletAddress, format);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`
    );
    res.send(result.content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
