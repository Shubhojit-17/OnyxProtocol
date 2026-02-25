import prisma from "../db/prisma.js";
import { wsManager } from "../websocket/manager.js";
import { getAssetPrice as getLivePrice, getAllPrices } from "./price.service.js";

export async function getVaultBalances(walletAddress: string) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) throw new Error("User not found");

  const balances = await prisma.vaultBalance.findMany({
    where: { userId: user.id },
  });

  // Fetch all prices once instead of N+1 queries
  const prices = await getAllPrices();
  function assetPrice(symbol: string): number {
    if (symbol === "STRK") return prices.strk || 0.31;
    if (symbol === "ETH" || symbol === "oETH") return prices.oETH || prices.eth || 2500;
    if (symbol === "oSEP") return prices.oSEP || 1;
    return 1;
  }

  const result = [];
  for (const b of balances) {
    const usdPrice = assetPrice(b.assetSymbol);
    result.push({
      ...b,
      usdPrice,
      publicUsd: b.publicBalance * usdPrice,
      shieldedUsd: b.shieldedBalance * usdPrice,
      lockedUsd: b.lockedBalance * usdPrice,
    });
  }

  return result;
}

export async function getVaultSummary(walletAddress: string) {
  const balances = await getVaultBalances(walletAddress);

  const totalPublicUsd = balances.reduce((s: number, b: any) => s + b.publicUsd, 0);
  const totalShieldedUsd = balances.reduce((s: number, b: any) => s + b.shieldedUsd, 0);
  const totalLockedUsd = balances.reduce((s: number, b: any) => s + b.lockedUsd, 0);

  // Format per-asset summary lines
  const publicSummary = balances.map((b: any) =>
    `${b.publicBalance.toFixed(4)} ${b.assetSymbol}`
  ).join(" + ");
  const shieldedSummary = balances.map((b: any) =>
    `${b.shieldedBalance.toFixed(4)} ${b.assetSymbol}`
  ).join(" + ");
  const lockedSummary = balances.map((b: any) =>
    `${b.lockedBalance.toFixed(4)} ${b.assetSymbol}`
  ).join(" + ");

  return {
    balances,
    totalPublic: publicSummary || "0 STRK",
    totalPublicUsd: totalPublicUsd.toFixed(2),
    totalShielded: shieldedSummary || "0 STRK",
    totalShieldedUsd: totalShieldedUsd.toFixed(2),
    totalLocked: lockedSummary || "0 STRK",
    totalLockedUsd: totalLockedUsd.toFixed(2),
  };
}

export async function deposit(
  walletAddress: string,
  assetSymbol: string,
  amount: number
) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) throw new Error("User not found");

  const balance = await prisma.vaultBalance.upsert({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol } },
    update: { publicBalance: { increment: amount } },
    create: {
      userId: user.id,
      assetSymbol,
      publicBalance: amount,
      shieldedBalance: 0,
      lockedBalance: 0,
    },
  });

  await prisma.activityEvent.create({
    data: {
      type: "VAULT_DEPOSIT",
      message: `Deposited ${amount} ${assetSymbol} to vault`,
      metadata: JSON.stringify({ walletAddress, assetSymbol, amount }),
    },
  });

  wsManager.emit("vault:updated", { walletAddress, assetSymbol, action: "deposit", amount });
  wsManager.emit("activity:new", {
    type: "VAULT_DEPOSIT",
    message: `Deposited ${amount} ${assetSymbol} to vault`,
  });

  return balance;
}

export async function withdraw(
  walletAddress: string,
  assetSymbol: string,
  amount: number
) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) throw new Error("User not found");

  const existing = await prisma.vaultBalance.findUnique({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol } },
  });

  if (!existing || existing.publicBalance < amount) {
    throw new Error("Insufficient public balance");
  }

  const balance = await prisma.vaultBalance.update({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol } },
    data: { publicBalance: { decrement: amount } },
  });

  await prisma.activityEvent.create({
    data: {
      type: "VAULT_WITHDRAW",
      message: `Withdrew ${amount} ${assetSymbol} from vault`,
      metadata: JSON.stringify({ walletAddress, assetSymbol, amount }),
    },
  });

  wsManager.emit("vault:updated", { walletAddress, assetSymbol, action: "withdraw", amount });
  wsManager.emit("activity:new", {
    type: "VAULT_WITHDRAW",
    message: `Withdrew ${amount} ${assetSymbol} from vault`,
  });

  return balance;
}

export async function shield(
  walletAddress: string,
  assetSymbol: string,
  amount: number
) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) throw new Error("User not found");

  const existing = await prisma.vaultBalance.findUnique({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol } },
  });

  if (!existing || existing.publicBalance < amount) {
    throw new Error("Insufficient public balance to shield");
  }

  const balance = await prisma.vaultBalance.update({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol } },
    data: {
      publicBalance: { decrement: amount },
      shieldedBalance: { increment: amount },
    },
  });

  await prisma.activityEvent.create({
    data: {
      type: "FUNDS_SHIELDED",
      message: `Shielded ${amount} ${assetSymbol}`,
      metadata: JSON.stringify({ walletAddress, assetSymbol, amount }),
    },
  });

  wsManager.emit("vault:updated", { walletAddress, assetSymbol, action: "shield", amount });
  wsManager.emit("activity:new", {
    type: "FUNDS_SHIELDED",
    message: `Shielded ${amount} ${assetSymbol}`,
  });

  return balance;
}

export async function unshield(
  walletAddress: string,
  assetSymbol: string,
  amount: number
) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) throw new Error("User not found");

  const existing = await prisma.vaultBalance.findUnique({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol } },
  });

  if (!existing || existing.shieldedBalance < amount) {
    throw new Error("Insufficient shielded balance");
  }

  const balance = await prisma.vaultBalance.update({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol } },
    data: {
      shieldedBalance: { decrement: amount },
      publicBalance: { increment: amount },
    },
  });

  await prisma.activityEvent.create({
    data: {
      type: "FUNDS_UNSHIELDED",
      message: `Unshielded ${amount} ${assetSymbol}`,
      metadata: JSON.stringify({ walletAddress, assetSymbol, amount }),
    },
  });

  wsManager.emit("vault:updated", { walletAddress, assetSymbol, action: "unshield", amount });
  wsManager.emit("activity:new", {
    type: "FUNDS_UNSHIELDED",
    message: `Unshielded ${amount} ${assetSymbol}`,
  });

  return balance;
}

export async function getRecentVaultActivity(walletAddress: string, limit = 10) {
  const activities = await prisma.activityEvent.findMany({
    where: {
      type: { in: ["VAULT_DEPOSIT", "VAULT_WITHDRAW", "FUNDS_SHIELDED", "FUNDS_UNSHIELDED"] },
      metadata: { contains: walletAddress },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return activities.map((a: any) => {
    const meta = a.metadata ? JSON.parse(a.metadata) : {};
    const typeMap: Record<string, string> = {
      VAULT_DEPOSIT: "Deposit",
      VAULT_WITHDRAW: "Withdraw",
      FUNDS_SHIELDED: "Shield",
      FUNDS_UNSHIELDED: "Unshield",
    };
    const displayType = typeMap[a.type] || a.type;
    const sign = ["VAULT_DEPOSIT", "FUNDS_SHIELDED"].includes(a.type) ? "+" : "-";
    return {
      type: displayType,
      amount: `${sign}${meta.amount} ${meta.assetSymbol}`,
      usd: meta.amount && meta.assetSymbol ? "" : "",
      time: getRelativeTime(a.createdAt),
      status: "Confirmed",
      hash: "0x" + a.id.replace(/-/g, "").slice(0, 16),
    };
  });
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
