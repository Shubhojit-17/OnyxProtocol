import { Router, Request, Response } from "express";
import {
  createOrder,
  listOrders,
  getOrderPool,
  cancelOrder,
} from "../services/order.service.js";
import { runMatcher } from "../services/matcher.service.js";
import { createOrderSchema } from "../utils/validation.js";

const router = Router();

// POST /api/orders/create
router.post("/create", async (req: Request, res: Response) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const order = await createOrder(parsed.data);
    res.json({ order });

    // Auto-run matcher after order creation (fire-and-forget)
    runMatcher().catch((err) => console.error("Auto-match failed:", err));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/orders/list?walletAddress=...
router.get("/list", async (req: Request, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      res.status(400).json({ error: "walletAddress required" });
      return;
    }

    const orders = await listOrders(walletAddress);
    res.json({ orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/pool
router.get("/pool", async (_req: Request, res: Response) => {
  try {
    const pool = await getOrderPool();
    res.json(pool);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/cancel
router.post("/cancel", async (req: Request, res: Response) => {
  try {
    const { walletAddress, orderId } = req.body;
    if (!walletAddress || !orderId) {
      res.status(400).json({ error: "walletAddress and orderId required" });
      return;
    }
    const result = await cancelOrder({ walletAddress, orderId });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
