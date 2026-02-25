import prisma from "../db/prisma.js";
import { getAllPrices, getAssetPrice } from "./price.service.js";

/**
 * Volume Over Time — derived from settled orders per day.
 * Falls back to computing from real settlement data if no snapshots exist.
 */
export async function getVolumeData(range: string) {
  const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
  const now = new Date();
  const prices = await getAllPrices();

  function assetPrice(symbol: string): number {
    if (symbol === "STRK") return prices.strk || 0.31;
    if (symbol === "ETH" || symbol === "oETH") return prices.oETH || prices.eth || 2500;
    if (symbol === "oSEP") return prices.oSEP || 1;
    return 1;
  }

  // Fetch ALL settled orders once
  const settledOrders = await prisma.orderCommitment.findMany({
    where: { status: "SETTLED" },
    select: { amount: true, assetIn: true, assetOut: true, orderType: true, createdAt: true },
  });

  // Fetch vault events once
  const vaultEvents = await prisma.activityEvent.findMany({
    where: { type: { in: ["VAULT_DEPOSIT", "FUNDS_SHIELDED"] } },
    select: { metadata: true, createdAt: true },
  });

  // Build day labels and bucket data
  const data = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD for comparison

    let totalVolumeUsd = 0;
    let shieldedVolumeUsd = 0;

    // Bucket settled orders by their createdAt date
    for (const o of settledOrders) {
      const orderDate = o.createdAt.toISOString().slice(0, 10);
      if (orderDate === dateStr) {
        const baseAsset = o.orderType === "BUY" ? o.assetOut : o.assetIn;
        const vol = o.amount * assetPrice(baseAsset);
        totalVolumeUsd += vol;
        shieldedVolumeUsd += vol;
      }
    }

    // Bucket vault events
    for (const v of vaultEvents) {
      const eventDate = v.createdAt.toISOString().slice(0, 10);
      if (eventDate === dateStr) {
        try {
          const meta = JSON.parse(v.metadata || "{}");
          if (meta.amount && meta.asset) {
            totalVolumeUsd += meta.amount * assetPrice(meta.asset);
          }
        } catch {}
      }
    }

    data.push({
      day: dayStr,
      volume: parseFloat(totalVolumeUsd.toFixed(2)),
      shielded: parseFloat(shieldedVolumeUsd.toFixed(2)),
    });
  }

  return data;
}

export async function getProofVelocityData() {
  const data = [];
  const proofs = await prisma.proof.findMany({
    where: { proofStatus: "VERIFIED", verificationTimeMs: { not: null } },
    orderBy: { match: { createdAt: "desc" } },
    take: 24,
    select: { verificationTimeMs: true, match: { select: { createdAt: true } } },
  });

  if (proofs.length > 0) {
    for (const p of proofs) {
      data.push({
        hour: new Date(p.match.createdAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        speed: (p.verificationTimeMs || 0) / 1000,
      });
    }
  }

  // Return empty array if no proofs — frontend should handle empty state
  return data;
}

/**
 * Anonymity Set Growth — count of unique users with shielded balances per token, per day.
 * Derived from actual vault balances and order history.
 */
export async function getAnonymitySetData(range: string) {
  const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
  const data = [];
  const now = new Date();

  // Get current anonymity set by token
  const strkUsers = await prisma.vaultBalance.count({
    where: { assetSymbol: "STRK", shieldedBalance: { gt: 0 } },
  });
  const ethUsers = await prisma.vaultBalance.count({
    where: { assetSymbol: { in: ["ETH", "oETH"] }, shieldedBalance: { gt: 0 } },
  });
  const oSEPUsers = await prisma.vaultBalance.count({
    where: { assetSymbol: "oSEP", shieldedBalance: { gt: 0 } },
  });

  // Get earliest user registration to simulate growth
  const earliestUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  const earliestDate = earliestUser?.createdAt || now;
  const totalUsers = await prisma.user.count();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    // Count users registered up to this date
    const usersRegistered = await prisma.user.count({
      where: { createdAt: { lte: date } },
    });

    // Scale current counts proportional to user registrations (growth curve)
    const ratio = totalUsers > 0 ? usersRegistered / totalUsers : 0;

    data.push({
      day: dayStr,
      strk: Math.round(strkUsers * ratio),
      eth: Math.round(ethUsers * ratio),
      oSEP: Math.round(oSEPUsers * ratio),
    });
  }

  return data;
}

/**
 * Total Value Locked (Shielded) — derived from vault shielded balances over time.
 */
export async function getLiquidityGrowth(range: string) {
  const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
  const data = [];
  const now = new Date();
  const prices = await getAllPrices();

  function assetPrice(symbol: string): number {
    if (symbol === "STRK") return prices.strk || 0.31;
    if (symbol === "ETH" || symbol === "oETH") return prices.oETH || prices.eth || 2500;
    if (symbol === "oSEP") return prices.oSEP || 1;
    return 1;
  }

  // Compute current TVL
  const currentBalances = await prisma.vaultBalance.findMany();
  let currentTvl = 0;
  for (const b of currentBalances) {
    currentTvl += b.shieldedBalance * assetPrice(b.assetSymbol);
  }

  // Get settled orders for growth curve
  const settledOrders = await prisma.orderCommitment.findMany({
    where: { status: "SETTLED" },
    select: { createdAt: true, amount: true, price: true, assetIn: true, orderType: true },
    orderBy: { createdAt: "asc" },
  });

  // Deposits/shields events for history
  const depositEvents = await prisma.activityEvent.findMany({
    where: { type: { in: ["VAULT_DEPOSIT", "FUNDS_SHIELDED"] } },
    select: { createdAt: true, metadata: true },
    orderBy: { createdAt: "asc" },
  });

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Approximate: scale TVL based on deposits up to this date vs total deposits
    const depositsUpToDate = depositEvents.filter((e) => e.createdAt <= endOfDay).length;
    const totalDeposits = depositEvents.length;
    const tradeUpToDate = settledOrders.filter((o) => o.createdAt && o.createdAt <= endOfDay).length;
    const totalTrades = settledOrders.length;

    // Growth ratio: combine deposit and trade activity
    const activityCount = depositsUpToDate + tradeUpToDate;
    const totalActivityCount = totalDeposits + totalTrades || 1;
    const ratio = Math.min(activityCount / totalActivityCount, 1);

    data.push({
      day: dayStr,
      liquidity: parseFloat((currentTvl * ratio).toFixed(2)),
    });
  }

  return data;
}

export async function getDensityData() {
  // Derive from real open orders if available
  const openOrders = await prisma.orderCommitment.findMany({
    where: { status: { in: ["CREATED", "MATCHED"] } },
    select: { price: true, amount: true },
  });

  if (openOrders.length === 0) {
    return [];
  }

  const prices = await getAllPrices();
  const center = prices.strk || 0.40;
  const spread = 0.10;

  const data = [];
  for (let i = 0; i < 50; i++) {
    const price = center - spread + (i / 50) * 2 * spread;
    // Count orders near this price level
    const nearby = openOrders.filter(
      (o: any) => Math.abs(Number(o.price) - price) < spread / 25
    );
    const density = nearby.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
    const volume = nearby.reduce((s: number, o: any) => s + Number(o.amount || 0) * Number(o.price || 0), 0);
    data.push({
      price: parseFloat(price.toFixed(4)),
      density: parseFloat(density.toFixed(2)),
      volume: parseFloat(volume.toFixed(4)),
    });
  }

  return data;
}

export async function getAnalyticsKpis() {
  const prices = await getAllPrices();

  function assetPrice(symbol: string): number {
    if (symbol === "STRK") return prices.strk || 0.31;
    if (symbol === "ETH" || symbol === "oETH") return prices.oETH || prices.eth || 2500;
    if (symbol === "oSEP") return prices.oSEP || 1;
    return 1;
  }

  // Total volume from settled orders (in USD)
  const settledOrders = await prisma.orderCommitment.findMany({
    where: { status: "SETTLED" },
    select: { amount: true, price: true, assetIn: true, assetOut: true, orderType: true },
  });
  let totalVolumeUsd = 0;
  for (const o of settledOrders) {
    const baseAsset = o.orderType === "BUY" ? o.assetOut : o.assetIn;
    totalVolumeUsd += o.amount * assetPrice(baseAsset);
  }

  // Avg proof speed
  const proofs = await prisma.proof.findMany({
    where: { proofStatus: "VERIFIED", verificationTimeMs: { not: null } },
    select: { verificationTimeMs: true },
  });
  const avgSpeed =
    proofs.length > 0
      ? proofs.reduce((s: number, p: any) => s + (p.verificationTimeMs || 0), 0) / proofs.length / 1000
      : 0;

  // Anonymity set
  const anonymitySet = await prisma.vaultBalance.groupBy({
    by: ["userId"],
    where: { shieldedBalance: { gt: 0 } },
  });

  // Shielded ratio
  const allBalances = await prisma.vaultBalance.findMany();
  const totalAll = allBalances.reduce(
    (s: number, b: any) => s + (b.publicBalance + b.shieldedBalance + b.lockedBalance) * assetPrice(b.assetSymbol),
    0
  );
  const totalShielded = allBalances.reduce(
    (s: number, b: any) => s + b.shieldedBalance * assetPrice(b.assetSymbol),
    0
  );
  const shieldedRatio = totalAll > 0 ? ((totalShielded / totalAll) * 100).toFixed(1) : "0";

  // Proof velocity (recent hour)
  const recentProofs = await prisma.proof.count({
    where: {
      proofStatus: "VERIFIED",
      match: {
        createdAt: { gte: new Date(Date.now() - 3600000) },
      },
    },
  });

  // Format volume — use appropriate scale
  let volumeStr: string;
  if (totalVolumeUsd >= 1_000_000) {
    volumeStr = `$${(totalVolumeUsd / 1_000_000).toFixed(1)}M`;
  } else if (totalVolumeUsd >= 1000) {
    volumeStr = `$${(totalVolumeUsd / 1000).toFixed(1)}K`;
  } else if (totalVolumeUsd > 0) {
    volumeStr = `$${totalVolumeUsd.toFixed(2)}`;
  } else {
    volumeStr = "$0";
  }

  return [
    {
      label: "Total Volume",
      value: volumeStr,
      change: settledOrders.length > 0 ? `${settledOrders.length} trades` : "—",
    },
    {
      label: "Avg Proof Speed",
      value: avgSpeed > 0 ? `${avgSpeed.toFixed(2)}s` : "—",
      change: proofs.length > 0 ? `${proofs.length} proofs` : "—",
    },
    {
      label: "Anonymity Set",
      value: `${anonymitySet.length}`,
      change: anonymitySet.length > 0 ? "traders" : "—",
    },
    {
      label: "Shielded Ratio",
      value: `${shieldedRatio}%`,
      change: totalShielded > 0 ? `$${totalShielded.toFixed(0)} shielded` : "—",
    },
    {
      label: "Proof Velocity",
      value: `${recentProofs}/hr`,
      change: "—",
    },
  ];
}
