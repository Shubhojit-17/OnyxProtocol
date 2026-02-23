import { Router, Request, Response } from "express";
import { getDarkPoolStats } from "../services/darkpool.service.js";

const router = Router();

// GET /api/darkpool/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const data = await getDarkPoolStats();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
