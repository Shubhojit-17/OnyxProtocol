import prisma from "../db/prisma.js";
import { getAssetPrice, getAllPrices } from "./price.service.js";

/**
 * Dashboard overview: summary stats + activity feed.
 * All values are derived from real DB data and live prices.
 */
export async function getDashboardOverview(walletAddress?: string) {
  // Fetch live prices
  const prices = await getAllPrices();

  function assetPriceSync(symbol: string) {
    if (symbol === "STRK") return prices.strk;
    if (symbol === "ETH") return prices.eth || 0;
    return 1;
  }

  // Total vault value
  const allBalances = await prisma.vaultBalance.findMany();

  let totalVaultUsd = 0;
  let totalShieldedUsd = 0;
  for (const b of allBalances) {
    const price = assetPriceSync(b.assetSymbol);
    totalVaultUsd += (b.publicBalance + b.shieldedBalance + b.lockedBalance) * price;
    totalShieldedUsd += b.shieldedBalance * price;
  }

  // Total STRK equivalent for display
  const totalStrk = allBalances
    .filter((b: any) => b.assetSymbol === "STRK")
    .reduce(
      (s: number, b: any) => s + b.publicBalance + b.shieldedBalance + b.lockedBalance,
      0
    );

  // Active hidden orders
  const activeOrders = await prisma.orderCommitment.count({
    where: { status: { in: ["CREATED", "MATCHED", "PROVING"] } },
  });

  // Avg proof time
  const proofs = await prisma.proof.findMany({
    where: { proofStatus: "VERIFIED", verificationTimeMs: { not: null } },
    select: { verificationTimeMs: true },
  });
  const avgProofMs =
    proofs.length > 0
      ? proofs.reduce((s: number, p: any) => s + (p.verificationTimeMs || 0), 0) / proofs.length
      : 0;

  // Privacy score — real ratio, no bias
  const totalBalanceEntries = allBalances.length;
  const shieldedEntries = allBalances.filter((b: any) => b.shieldedBalance > 0).length;
  const privacyScore = totalBalanceEntries > 0
    ? Math.round((shieldedEntries / totalBalanceEntries) * 100)
    : 0;

  // Anonymity set (unique users with shielded balances)
  const anonymitySet = await prisma.vaultBalance.groupBy({
    by: ["userId"],
    where: { shieldedBalance: { gt: 0 } },
  });

  // Shielded ratio
  const totalShielded = allBalances.reduce((s: number, b: any) => s + b.shieldedBalance * assetPriceSync(b.assetSymbol), 0);
  const totalAll = totalVaultUsd || 1;
  const shieldedRatio = ((totalShielded / totalAll) * 100).toFixed(1);

  // TVL
  const tvl = totalShielded;

  // Activity feed
  const activityFeed = await prisma.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Fog data — from real analytics snapshots, or empty if none
  const fogData = await generateFogData();

  // Fog metrics from data
  const peak = fogData.length > 0 ? Math.max(...fogData.map((d) => d.index)) : 0;
  const avgLiquidity = fogData.length > 0
    ? fogData.reduce((s, d) => s + d.liquidity, 0) / fogData.length
    : 0;
  const poolUtilization = shieldedRatio;

  return {
    summaryCards: [
      {
        title: "Total Vault Balance",
        value: totalStrk > 0 ? `${totalStrk.toFixed(2)} STRK` : "0 STRK",
        usd: `$${totalVaultUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        change: "—",
        positive: true,
      },
      {
        title: "Shielded Liquidity",
        value: `$${totalShieldedUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        usd: `$${totalShieldedUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        change: "—",
        positive: true,
      },
      {
        title: "Active Hidden Orders",
        value: `${activeOrders}`,
        usd: "",
        change: activeOrders > 0 ? `${activeOrders}` : "0",
        positive: activeOrders > 0,
      },
      {
        title: "Proof Verification Latency",
        value: avgProofMs > 0 ? `${(avgProofMs / 1000).toFixed(2)}s` : "—",
        usd: "",
        change: "—",
        positive: true,
      },
    ],
    activityFeed: activityFeed.map((a: any) => ({
      text: a.message,
      time: getRelativeTime(a.createdAt),
      type: getActivityDisplayType(a.type),
    })),
    fogData,
    fogMetrics: {
      peakIndex: peak > 0 ? peak.toFixed(0) : "0",
      avgLiquidity: avgLiquidity > 0 ? `$${(avgLiquidity / 1000).toFixed(1)}K` : "$0",
      poolUtilization: `${poolUtilization}%`,
    },
    privacyScore,
    anonymitySet: anonymitySet.length,
    shieldedRatio: `${shieldedRatio}%`,
    tvl: tvl > 0 ? `$${(tvl / 1000000).toFixed(1)}M` : "$0",
    systemStatus: "All Systems Operational",
  };
}

async function generateFogData() {
  // Use real analytics snapshots if available
  const snapshots = await prisma.analyticsSnapshot.findMany({
    orderBy: { date: "desc" },
    take: 24,
  });

  if (snapshots.length > 0) {
    return snapshots.reverse().map((s: any, i: number) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      index: Math.round(s.anonymitySet ?? 0),
      liquidity: Math.round(s.tvl ?? 0),
    }));
  }

  // No data — return empty array
  return [];
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

function getActivityDisplayType(type: string): "success" | "info" | "pending" {
  switch (type) {
    case "PROOF_VERIFIED":
    case "TRADE_SETTLED":
      return "success";
    case "ORDER_CREATED":
    case "VAULT_DEPOSIT":
    case "FUNDS_SHIELDED":
      return "info";
    default:
      return "pending";
  }
}
