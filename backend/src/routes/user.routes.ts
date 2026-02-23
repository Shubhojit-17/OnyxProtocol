import { Router, Request, Response } from "express";
import { connectUser, getUserByWallet, updateUserSettings } from "../services/user.service.js";
import { connectSchema } from "../utils/validation.js";

const router = Router();

// POST /api/users/connect
router.post("/connect", async (req: Request, res: Response) => {
  try {
    const parsed = connectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const user = await connectUser(parsed.data.walletAddress);
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/me?walletAddress=...
router.get("/me", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress required" });
      return;
    }

    const user = await getUserByWallet(walletAddress);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/settings
router.put("/settings", async (req: Request, res: Response) => {
  try {
    const { walletAddress, ...settings } = req.body;
    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress required" });
      return;
    }

    const updated = await updateUserSettings(walletAddress, settings);
    res.json({ settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
