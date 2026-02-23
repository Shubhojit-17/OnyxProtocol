import prisma from "../db/prisma.js";
import { getAllPrices } from "./price.service.js";

/**
 * Returns dark pool statistics derived from real DB data and live prices.
 */
export async function getDarkPoolStats() {
  const prices = await getAllPrices();
  const strkPrice = prices.strk;

  // Total open orders
  const openOrders = await prisma.orderCommitment.count({
    where: { status: "CREATED" },
  });

  // Recent events
  const recentEvents = await prisma.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  // Avg proof velocity
  const proofs = await prisma.proof.findMany({
    where: { proofStatus: "VERIFIED", verificationTimeMs: { not: null } },
    select: { verificationTimeMs: true },
    take: 50,
  });
  const avgProofSpeed =
    proofs.length > 0
      ? proofs.reduce((s: number, p: any) => s + (p.verificationTimeMs || 0), 0) / proofs.length / 1000
      : 0;

  // Generate heatmap from real order density (or empty)
  const heatmapData = await generateHeatmapData();

  // Volume: sum of all settled order amounts * STRK price
  const settledOrders = await prisma.orderCommitment.findMany({
    where: { status: "SETTLED" },
    select: { amount: true },
  });
  const totalVolumeStrk = settledOrders.reduce((s: number, o: any) => s + (o.amount?.toNumber?.() || Number(o.amount) || 0), 0);
  const totalVolumeUsd = totalVolumeStrk * strkPrice;
  const volume24h = totalVolumeUsd >= 1_000_000
    ? `$${(totalVolumeUsd / 1_000_000).toFixed(1)}M`
    : totalVolumeUsd >= 1_000
    ? `$${(totalVolumeUsd / 1_000).toFixed(1)}K`
    : `$${totalVolumeUsd.toFixed(0)}`;

  // Anonymity set: total unique users with open orders
  const anonymityUsers = await prisma.orderCommitment.findMany({
    where: { status: "CREATED" },
    select: { userId: true },
    distinct: ["userId"],
  });
  const anonymitySet = anonymityUsers.length;

  // Liquidity zone estimates per pair
  const orderPool = await prisma.orderCommitment.findMany({
    where: { status: "CREATED" },
    select: { assetIn: true, assetOut: true, orderType: true },
  });

  const pairMap = new Map<string, { buys: number; sells: number }>();
  for (const o of orderPool) {
    const pair = `${o.assetIn} / ${o.assetOut}`;
    const entry = pairMap.get(pair) || { buys: 0, sells: 0 };
    if (o.orderType === "BUY") entry.buys++;
    else entry.sells++;
    pairMap.set(pair, entry);
  }

  return {
    hiddenOrderCount: openOrders,
    midPrice: strkPrice > 0 ? `$${strkPrice.toLocaleString("en-US", { minimumFractionDigits: 4 })}` : "—",
    midPriceRaw: strkPrice,
    oracle: "CoinGecko",
    proofVelocity: avgProofSpeed > 0 ? `${avgProofSpeed.toFixed(2)}s` : "—",
    volume24h,
    anonymitySet,
    heatmapData,
    pairStats: Array.from(pairMap.entries()).map(([pair, counts]) => ({
      pair,
      buys: counts.buys,
      sells: counts.sells,
    })),
    events: recentEvents.map((e: any) => ({
      text: e.message,
      time: getRelativeTime(e.createdAt),
      type: getEventDisplayType(e.type),
    })),
    priceLevels: strkPrice > 0 ? generatePriceLevels(strkPrice) : [],
  };
}

async function generateHeatmapData(): Promise<number[][]> {
  // Build heatmap from real open orders — if none, return an empty grid
  const openOrders = await prisma.orderCommitment.findMany({
    where: { status: { in: ["CREATED", "MATCHED", "PROVING"] } },
    select: { price: true, amount: true, orderType: true },
  });

  const rows = 20;
  const cols = 30;

  if (openOrders.length === 0) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
  }

  // Normalize order prices into a grid
  const prices = openOrders.map((o: any) => Number(o.price) || 0).filter((p) => p > 0);
  const amounts = openOrders.map((o: any) => Number(o.amount) || 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const data: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < openOrders.length; i++) {
    const price = prices[i];
    const amount = amounts[i];
    if (!price) continue;
    const row = Math.min(rows - 1, Math.floor(((price - minPrice) / priceRange) * (rows - 1)));
    const col = Math.min(cols - 1, i % cols);
    data[row][col] += amount;
  }

  // Normalize to 0–1
  const maxVal = Math.max(...data.flat());
  if (maxVal > 0) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        data[r][c] = parseFloat((data[r][c] / maxVal).toFixed(3));
      }
    }
  }

  return data;
}

function generatePriceLevels(midPrice: number) {
  return [
    `$${(midPrice * 1.2).toFixed(4)}`,
    `$${(midPrice * 1.1).toFixed(4)}`,
    `$${midPrice.toFixed(4)}`,
    `$${(midPrice * 0.9).toFixed(4)}`,
    `$${(midPrice * 0.8).toFixed(4)}`,
  ];
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function getEventDisplayType(type: string): string {
  switch (type) {
    case "ORDER_CREATED":
      return "New order committed";
    case "ORDER_MATCHED":
      return "Match executed";
    case "PROOF_VERIFIED":
      return "Proof verified";
    case "FUNDS_SHIELDED":
      return "Liquidity added";
    default:
      return type;
  }
}
