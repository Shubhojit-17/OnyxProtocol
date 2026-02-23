import { Router, Request, Response } from "express";
import {
  getVolumeData,
  getProofVelocityData,
  getAnonymitySetData,
  getLiquidityGrowth,
  getDensityData,
  getAnalyticsKpis,
} from "../services/analytics.service.js";

const router = Router();

// GET /api/analytics/volume?range=24h|7d|30d
router.get("/volume", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "7d";
    const data = await getVolumeData(range);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/anonymity-set?range=...
router.get("/anonymity-set", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "7d";
    const data = await getAnonymitySetData(range);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/proof-velocity
router.get("/proof-velocity", async (_req: Request, res: Response) => {
  try {
    const data = await getProofVelocityData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/liquidity-growth?range=...
router.get("/liquidity-growth", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "7d";
    const data = await getLiquidityGrowth(range);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/density
router.get("/density", async (_req: Request, res: Response) => {
  try {
    const data = await getDensityData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/kpis
router.get("/kpis", async (_req: Request, res: Response) => {
  try {
    const data = await getAnalyticsKpis();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
