import { Router, type Request, type Response } from "express";
import { getNetworkInfo, getCommitmentCount, getMatchCount } from "../services/starknet.service.js";

const router = Router();

/**
 * GET /api/starknet/status
 * Returns the Starknet integration status and network info.
 */
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const info = await getNetworkInfo();
    const commitmentCount = await getCommitmentCount();
    const matchCount = await getMatchCount();

    res.json({
      ...info,
      onChainCommitments: commitmentCount,
      onChainMatches: matchCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
