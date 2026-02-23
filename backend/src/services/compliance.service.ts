import prisma from "../db/prisma.js";
import { generateViewingKey } from "../utils/helpers.js";

export async function generateComplianceViewingKey(params: {
  walletAddress: string;
  matchId: string;
  expiresAt: string;
}) {
  const user = await prisma.user.findUnique({
    where: { walletAddress: params.walletAddress },
  });
  if (!user) throw new Error("User not found");

  // Verify the match exists and belongs to the user
  const match = await prisma.match.findUnique({
    where: { id: params.matchId },
    include: { buyOrder: true, sellOrder: true },
  });

  if (!match) throw new Error("Match not found");
  if (match.buyOrder.userId !== user.id && match.sellOrder.userId !== user.id) {
    throw new Error("Match does not belong to this user");
  }

  const key = generateViewingKey();

  const viewingKey = await prisma.complianceViewingKey.create({
    data: {
      userId: user.id,
      matchId: params.matchId,
      viewingKey: key,
      expiresAt: new Date(params.expiresAt),
    },
  });

  return {
    id: viewingKey.id,
    viewingKey: key,
    matchId: params.matchId,
    expiresAt: viewingKey.expiresAt.toISOString(),
    shareUrl: `https://onyxprotocol.com/view/${key}`,
  };
}

export async function viewByKey(viewingKey: string) {
  const key = await prisma.complianceViewingKey.findUnique({
    where: { viewingKey },
    include: {
      match: {
        include: {
          buyOrder: true,
          sellOrder: true,
          proof: true,
          settlement: true,
        },
      },
      user: { select: { walletAddress: true } },
    },
  });

  if (!key) throw new Error("Viewing key not found");
  if (new Date() > key.expiresAt) throw new Error("Viewing key has expired");

  // Increment view count
  await prisma.complianceViewingKey.update({
    where: { viewingKey },
    data: { views: { increment: 1 } },
  });

  return {
    match: {
      id: key.matchId,
      pair: key.match.pair,
      status: key.match.status,
      createdAt: key.match.createdAt.toISOString(),
    },
    proof: key.match.proof
      ? {
          proofId: key.match.proof.proofId,
          status: key.match.proof.proofStatus,
          verifier: key.match.proof.verifier,
        }
      : null,
    settlement: key.match.settlement
      ? {
          txHash: key.match.settlement.txHash,
          network: key.match.settlement.network,
          settledAt: key.match.settlement.settledAt.toISOString(),
        }
      : null,
    expiresAt: key.expiresAt.toISOString(),
  };
}

export async function revokeViewingKey(walletAddress: string, viewingKeyId: string) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) throw new Error("User not found");

  const key = await prisma.complianceViewingKey.findUnique({
    where: { id: viewingKeyId },
  });
  if (!key) throw new Error("Viewing key not found");
  if (key.userId !== user.id) throw new Error("Viewing key does not belong to this user");

  // "Revoke" by setting expiry to now
  const updated = await prisma.complianceViewingKey.update({
    where: { id: viewingKeyId },
    data: { expiresAt: new Date() },
  });

  return { id: updated.id, revoked: true };
}

export async function getComplianceSummary(walletAddress: string) {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
  });
  if (!user) return { keys: [], summary: { total: 0, active: 0, expired: 0, disclosed: 0, totalViews: 0 } };

  const keys = await prisma.complianceViewingKey.findMany({
    where: { userId: user.id },
    include: {
      match: {
        include: { buyOrder: true, sellOrder: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  const formattedKeys = keys.map((k: any) => ({
    id: k.id,
    shortId: `VK-${k.id.slice(0, 4).toUpperCase()}`,
    matchId: k.matchId,
    transactions: [k.match.pair],
    expiresAt: k.expiresAt.toISOString(),
    expiry: k.expiresAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    status: now > k.expiresAt ? "Expired" : "Active",
    key: k.viewingKey,
    views: k.views,
    created: k.createdAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  }));

  const active = formattedKeys.filter((k: any) => k.status === "Active").length;
  const expired = formattedKeys.filter((k: any) => k.status === "Expired").length;

  // Get user's matches for "selectable transactions"
  const userOrders = await prisma.orderCommitment.findMany({
    where: { userId: user.id, status: { in: ["MATCHED", "VERIFIED", "SETTLED"] } },
    include: {
      buyMatch: true,
      sellMatch: true,
    },
  });

  const transactions = userOrders.map((o: any) => {
    const match = o.buyMatch || o.sellMatch;
    return {
      id: match?.id ?? o.id,
      pair: `${o.assetIn} / ${o.assetOut}`,
      date: o.createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      amount: "████████",
    };
  });

  return {
    keys: formattedKeys,
    transactions,
    summary: {
      total: keys.length,
      active,
      expired,
      disclosed: keys.reduce((s: number, k: any) => s + (k.views > 0 ? 1 : 0), 0),
      totalViews: keys.reduce((s: number, k: any) => s + k.views, 0),
    },
  };
}
