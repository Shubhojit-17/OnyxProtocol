import { Router, Request, Response } from "express";
import {
  generateComplianceViewingKey,
  viewByKey,
  getComplianceSummary,
  revokeViewingKey,
} from "../services/compliance.service.js";
import { generateViewingKeySchema } from "../utils/validation.js";

const router = Router();

// POST /api/compliance/generate-viewing-key
router.post("/generate-viewing-key", async (req: Request, res: Response) => {
  try {
    const parsed = generateViewingKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const result = await generateComplianceViewingKey(parsed.data);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/compliance/view/:viewingKey
router.get("/view/:viewingKey", async (req: Request, res: Response) => {
  try {
    const data = await viewByKey(req.params.viewingKey as string);
    res.json(data);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/compliance/summary?walletAddress=...
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress required" });
      return;
    }

    const data = await getComplianceSummary(walletAddress);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compliance/revoke
router.post("/revoke", async (req: Request, res: Response) => {
  try {
    const { walletAddress, viewingKeyId } = req.body;
    if (!walletAddress || !viewingKeyId) {
      res.status(400).json({ error: "walletAddress and viewingKeyId required" });
      return;
    }
    const result = await revokeViewingKey(walletAddress, viewingKeyId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
