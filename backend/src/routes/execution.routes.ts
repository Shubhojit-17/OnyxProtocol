import { Router, Request, Response } from "express";
import { runMatcher, generateProof, getProofStatus } from "../services/matcher.service.js";
import {
  getExecutionTimeline,
  getMatches,
  getExecutionStats,
} from "../services/execution.service.js";
import prisma from "../db/prisma.js";

const router = Router();

// POST /api/matcher/run
router.post("/matcher/run", async (_req: Request, res: Response) => {
  try {
    // Ensure all CREATED orders allow cross-pair (migrates legacy orders)
    await prisma.orderCommitment.updateMany({
      where: { status: "CREATED", allowCrossPair: false },
      data: { allowCrossPair: true },
    });

    const result = await runMatcher();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/execution/timeline?walletAddress=...
router.get("/execution/timeline", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress required" });
      return;
    }

    const timeline = await getExecutionTimeline(walletAddress);
    res.json({ executions: timeline });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/execution/stats
router.get("/execution/stats", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string | undefined;
    const stats = await getExecutionStats(walletAddress);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/matches/list?walletAddress=...
router.get("/matches/list", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress required" });
      return;
    }

    const matches = await getMatches(walletAddress);
    res.json({ matches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proofs/generate
router.post("/proofs/generate", async (req: Request, res: Response) => {
  try {
    const { matchId } = req.body;
    if (!matchId) {
      res.status(400).json({ error: "matchId required" });
      return;
    }

    const result = await generateProof(matchId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/proofs/status/:matchId
router.get("/proofs/status/:matchId", async (req: Request, res: Response) => {
  try {
    const status = await getProofStatus(req.params.matchId as string);
    res.json(status);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
