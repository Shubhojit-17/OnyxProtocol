import prisma from "../db/prisma.js";
import { getAllPrices } from "./price.service.js";

export async function getVolumeData(range: string) {
  const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
  const data = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await prisma.analyticsSnapshot.findFirst({
      where: {
        date: { gte: startOfDay, lt: endOfDay },
      },
    });

    data.push({
      day: dayStr,
      volume: snapshot?.totalVolume ?? 0,
      shielded: snapshot?.shieldedVolume ?? 0,
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

export async function getAnonymitySetData(range: string) {
  const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
  const data = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999));

    const snapshot = await prisma.analyticsSnapshot.findFirst({
      where: {
        date: { gte: startOfDay, lt: endOfDay },
      },
    });

    const base = snapshot?.anonymitySet ?? 0;
    data.push({
      day: dayStr,
      strk: Math.floor(base * 0.6),
      eth: Math.floor(base * 0.4),
    });
  }

  return data;
}

export async function getLiquidityGrowth(range: string) {
  const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
  const data = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999));

    const snapshot = await prisma.analyticsSnapshot.findFirst({
      where: {
        date: { gte: startOfDay, lt: endOfDay },
      },
    });

    data.push({
      day: dayStr,
      liquidity: snapshot?.tvl ?? 0,
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
  // Total volume from settled orders
  const settledOrders = await prisma.orderCommitment.findMany({
    where: { status: "SETTLED" },
    select: { amount: true, price: true },
  });
  const totalVolume = settledOrders.reduce(
    (s: number, o: any) => s + (Number(o.amount) || 0) * (Number(o.price) || 0),
    0
  );

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
    (s: number, b: any) => s + b.publicBalance + b.shieldedBalance + b.lockedBalance,
    0
  );
  const totalShielded = allBalances.reduce((s: number, b: any) => s + b.shieldedBalance, 0);
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

  return [
    {
      label: "Total Volume",
      value: totalVolume > 0 ? `$${(totalVolume / 1000000).toFixed(1)}M` : "$0",
      change: "—",
    },
    {
      label: "Avg Proof Speed",
      value: avgSpeed > 0 ? `${avgSpeed.toFixed(2)}s` : "—",
      change: "—",
    },
    {
      label: "Anonymity Set",
      value: `${anonymitySet.length}`,
      change: "—",
    },
    {
      label: "Shielded Ratio",
      value: `${shieldedRatio}%`,
      change: "—",
    },
    {
      label: "Proof Velocity",
      value: `${recentProofs}/hr`,
      change: "—",
    },
  ];
}
