import { z } from "zod";

// Starknet-style wallet address: 0x followed by 1-64 hex chars
export const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{1,64}$/, "Invalid wallet address format");

export const connectSchema = z.object({
  walletAddress: walletAddressSchema,
});

const SUPPORTED_ASSETS = ["STRK", "oETH", "oSEP"] as const;
const assetSymbolSchema = z.enum(SUPPORTED_ASSETS, { errorMap: () => ({ message: "Unsupported asset. Use STRK, oETH, or oSEP" }) });

export const depositSchema = z.object({
  walletAddress: walletAddressSchema,
  assetSymbol: assetSymbolSchema,
  amount: z.number().positive().max(1_000_000, "Amount too large"),
});

export const withdrawSchema = z.object({
  walletAddress: walletAddressSchema,
  assetSymbol: assetSymbolSchema,
  amount: z.number().positive().max(1_000_000, "Amount too large"),
});

export const shieldSchema = z.object({
  walletAddress: walletAddressSchema,
  assetSymbol: assetSymbolSchema,
  amount: z.number().positive().max(1_000_000, "Amount too large"),
});

export const unshieldSchema = z.object({
  walletAddress: walletAddressSchema,
  assetSymbol: assetSymbolSchema,
  amount: z.number().positive().max(1_000_000, "Amount too large"),
});

export const createOrderSchema = z.object({
  walletAddress: walletAddressSchema,
  assetIn: assetSymbolSchema,
  assetOut: assetSymbolSchema,
  orderType: z.enum(["BUY", "SELL"]),
  amount: z.number().positive().max(1_000_000, "Amount too large"),
  price: z.number().positive().max(1_000_000, "Price too large"),
  commitmentHash: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  allowPartialFill: z.boolean().optional().default(true),
  allowCrossPair: z.boolean().optional().default(true),
}).refine((data) => data.assetIn !== data.assetOut, {
  message: "assetIn and assetOut must be different",
  path: ["assetOut"],
});

export const generateViewingKeySchema = z.object({
  walletAddress: walletAddressSchema,
  matchId: z.string().uuid(),
  expiresAt: z.string().datetime(),
});

export const rangeSchema = z.enum(["24h", "7d", "30d"]).default("7d");
