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
import { faucetMintTokens } from "../services/starknet.service.js";
import prisma from "../db/prisma.js";
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

// Fixed faucet amounts (one-time claim)
const FAUCET_AMOUNTS: Record<string, number> = { oETH: 1, oSEP: 10 };

// GET /api/vault/faucet/status — check if user already claimed
router.get("/faucet/status", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) { res.status(400).json({ error: "walletAddress required" }); return; }
    const user = await prisma.user.findUnique({ where: { walletAddress } });
    res.json({ claimed: user?.faucetClaimed ?? false, amounts: FAUCET_AMOUNTS });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vault/faucet — one-time mint of 1 oETH + 10 oSEP to vault
router.post("/faucet", async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress is required" });
      return;
    }

    // Check if already claimed
    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.faucetClaimed) {
      res.status(400).json({ error: "Faucet already claimed. Each user can only claim once." });
      return;
    }

    const results: { symbol: string; txHash: string | null; amount: number }[] = [];

    // Mint both tokens
    for (const [symbol, amount] of Object.entries(FAUCET_AMOUNTS)) {
      const tokenAmount = BigInt(Math.floor(amount * 1e18));
      const txHash = await faucetMintTokens(walletAddress, symbol as "oETH" | "oSEP", tokenAmount);
      await deposit(walletAddress, symbol, amount);
      results.push({ symbol, txHash, amount });
    }

    // Mark as claimed
    await prisma.user.update({ where: { walletAddress }, data: { faucetClaimed: true } });

    res.json({
      success: true,
      claimed: true,
      results,
      message: `Minted 1 oETH + 10 oSEP to your vault`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
