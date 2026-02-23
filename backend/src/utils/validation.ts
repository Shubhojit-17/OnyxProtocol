import { z } from "zod";

// Starknet-style wallet address: 0x followed by 1-64 hex chars
export const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{1,64}$/, "Invalid wallet address format");

export const connectSchema = z.object({
  walletAddress: walletAddressSchema,
});

export const depositSchema = z.object({
  walletAddress: walletAddressSchema,
  assetSymbol: z.string().min(1),
  amount: z.number().positive(),
});

export const withdrawSchema = z.object({
  walletAddress: walletAddressSchema,
  assetSymbol: z.string().min(1),
  amount: z.number().positive(),
});

export const shieldSchema = z.object({
  walletAddress: walletAddressSchema,
  assetSymbol: z.string().min(1),
  amount: z.number().positive(),
});

export const unshieldSchema = z.object({
  walletAddress: walletAddressSchema,
  assetSymbol: z.string().min(1),
  amount: z.number().positive(),
});

export const createOrderSchema = z.object({
  walletAddress: walletAddressSchema,
  assetIn: z.string().min(1),
  assetOut: z.string().min(1),
  orderType: z.enum(["BUY", "SELL"]),
  amount: z.number().positive(),
  price: z.number().positive(),
  commitmentHash: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const generateViewingKeySchema = z.object({
  walletAddress: walletAddressSchema,
  matchId: z.string().uuid(),
  expiresAt: z.string().datetime(),
});

export const rangeSchema = z.enum(["24h", "7d", "30d"]).default("7d");
