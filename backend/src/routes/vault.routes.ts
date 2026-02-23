import { Router, Request, Response } from "express";
import {
  getVaultBalances,
  getVaultSummary,
  deposit,
  withdraw,
  shield,
  unshield,
  getRecentVaultActivity,
} from "../services/vault.service.js";
import {
  depositSchema,
  withdrawSchema,
  shieldSchema,
  unshieldSchema,
} from "../utils/validation.js";

const router = Router();

// GET /api/vault/balances?walletAddress=...
router.get("/balances", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress required" });
      return;
    }

    const summary = await getVaultSummary(walletAddress);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vault/activity?walletAddress=...
router.get("/activity", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress required" });
      return;
    }

    const activity = await getRecentVaultActivity(walletAddress);
    res.json(activity);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vault/deposit
router.post("/deposit", async (req: Request, res: Response) => {
  try {
    const parsed = depositSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const balance = await deposit(
      parsed.data.walletAddress,
      parsed.data.assetSymbol,
      parsed.data.amount
    );
    res.json({ balance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/vault/withdraw
router.post("/withdraw", async (req: Request, res: Response) => {
  try {
    const parsed = withdrawSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const balance = await withdraw(
      parsed.data.walletAddress,
      parsed.data.assetSymbol,
      parsed.data.amount
    );
    res.json({ balance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/vault/shield
router.post("/shield", async (req: Request, res: Response) => {
  try {
    const parsed = shieldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const balance = await shield(
      parsed.data.walletAddress,
      parsed.data.assetSymbol,
      parsed.data.amount
    );
    res.json({ balance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/vault/unshield
router.post("/unshield", async (req: Request, res: Response) => {
  try {
    const parsed = unshieldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const balance = await unshield(
      parsed.data.walletAddress,
      parsed.data.assetSymbol,
      parsed.data.amount
    );
    res.json({ balance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
