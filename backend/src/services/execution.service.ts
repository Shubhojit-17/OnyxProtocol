import prisma from "../db/prisma.js";
import { shortOrderId, shortMatchId } from "../utils/helpers.js";

/**
 * Get the execution timeline for a user's matched orders.
 */
export async function getExecutionTimeline(walletAddress: string) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) return [];

  // Get all user orders — including CREATED ones to show full pipeline
  const orders = await prisma.orderCommitment.findMany({
    where: {
      userId: user.id,
    },
    include: {
      buyMatch: {
        include: { proof: true, settlement: true, sellOrder: true },
      },
      sellMatch: {
        include: { proof: true, settlement: true, buyOrder: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o: any) => {
    const match = o.buyMatch || o.sellMatch;
    const proof = match?.proof;
    const settlement = match?.settlement;

    const steps = buildSteps(o, match, proof, settlement);

    const statusMap: Record<string, string> = {
      CREATED: "Awaiting Match",
      MATCHED: "Matched",
      PROVING: "Proving",
      VERIFIED: "Verified",
      SETTLED: "Settled",
      EXPIRED: "Expired",
      CANCELLED: "Failed",
    };

    return {
      id: shortOrderId(o.id),
      orderId: o.id,
      matchId: match?.id,
      proofId: proof?.proofId
        ? `${proof.proofId.slice(0, 6)}...${proof.proofId.slice(-4)}`
        : null,
      fullProofId: proof?.proofId || null,
      status: statusMap[o.status] || o.status,
      pair: `${o.assetIn} / ${o.assetOut}`,
      amount: `${o.amount} ${o.assetIn}`,
      steps,
      certificate: proof?.proofStatus === "VERIFIED"
        ? {
            proofId: proof.proofId,
            result: "VALID",
            txHash: settlement?.txHash
              ? `${settlement.txHash.slice(0, 10)}...${settlement.txHash.slice(-8)}`
              : null,
            fullTxHash: settlement?.txHash ?? null,
            gasUsed: settlement?.gasUsed ?? null,
            timeToVerify: proof.verificationTimeMs
              ? `${(proof.verificationTimeMs / 1000).toFixed(1)}s`
              : null,
            proofSize: proof.proofSize,
            verifier: proof.verifier,
          }
        : null,
    };
  });
}

function buildSteps(
  order: any,
  match: any,
  proof: any,
  settlement: any
) {
  const steps: {
    name: string;
    status: string;
    time: string;
    detail: string;
  }[] = [];

  // Step 1: Order Commitment
  steps.push({
    name: "Order Commitment",
    status: "done",
    time: formatTime(order.createdAt),
    detail: `${order.orderType} ${order.amount} ${order.assetIn} — Hash: ${order.commitmentHash.slice(0, 12)}...`,
  });

  // Step 2: Match Found
  if (match) {
    steps.push({
      name: "Match Found",
      status: "done",
      time: formatTime(match.createdAt),
      detail: `Pair matched in ${order.assetIn}/${order.assetOut} dark pool`,
    });
  } else {
    steps.push({
      name: "Match Found",
      status: "active",
      time: "",
      detail: "Searching for counterparty in the dark pool...",
    });
    return steps;
  }

  // Step 3: ZK Proof
  if (proof) {
    if (proof.proofStatus === "PENDING") {
      steps.push({
        name: "ZK Proof Generation",
        status: "pending",
        time: "",
        detail: "Waiting for prover",
      });
    } else if (proof.proofStatus === "GENERATED" || proof.proofStatus === "VERIFIED") {
      steps.push({
        name: "ZK Proof Generation",
        status: "done",
        time: proof.verificationTimeMs
          ? `${(proof.verificationTimeMs / 1000).toFixed(1)}s`
          : "",
        detail: `Proof: ${proof.proofId.slice(0, 10)}...`,
      });
    } else {
      steps.push({
        name: "ZK Proof Generation",
        status: "failed",
        time: "",
        detail: "Proof generation failed",
      });
    }
  }

  // Step 4: On-chain Verification
  if (proof?.proofStatus === "VERIFIED") {
    steps.push({
      name: "On-chain Verification",
      status: "done",
      time: proof.verificationTimeMs
        ? `${(proof.verificationTimeMs / 1000).toFixed(1)}s`
        : "",
      detail: "Verified by Starknet SHARP",
    });
  } else if (proof?.proofStatus === "GENERATED") {
    steps.push({
      name: "On-chain Verification",
      status: "active",
      time: "",
      detail: "Verifying proof on-chain...",
    });
  } else if (match) {
    steps.push({
      name: "On-chain Verification",
      status: "pending",
      time: "",
      detail: "Awaiting proof",
    });
  }

  // Step 5: Settlement
  if (settlement) {
    steps.push({
      name: "Settlement",
      status: "done",
      time: formatTime(settlement.settledAt),
      detail: `Tx: ${settlement.txHash.slice(0, 10)}...`,
    });
  } else if (proof?.proofStatus === "VERIFIED") {
    steps.push({
      name: "Settlement",
      status: "active",
      time: "",
      detail: "Settling on-chain...",
    });
  }

  return steps;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Get all matches for a user (as buyer or seller).
 */
export async function getMatches(walletAddress: string) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) return [];

  const orders = await prisma.orderCommitment.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  const orderIds = orders.map((o: any) => o.id);

  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { buyOrderId: { in: orderIds } },
        { sellOrderId: { in: orderIds } },
      ],
    },
    include: {
      proof: true,
      settlement: true,
      buyOrder: true,
      sellOrder: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return matches.map((m: any) => ({
    id: m.id,
    shortId: shortMatchId(m.id),
    pair: m.pair,
    amount: m.amount,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    proof: m.proof
      ? {
          proofId: m.proof.proofId,
          status: m.proof.proofStatus,
          verificationTimeMs: m.proof.verificationTimeMs,
        }
      : null,
    settlement: m.settlement
      ? {
          txHash: m.settlement.txHash,
          gasUsed: m.settlement.gasUsed,
          settledAt: m.settlement.settledAt.toISOString(),
        }
      : null,
  }));
}

/**
 * Execution stats summary.
 */
export async function getExecutionStats(walletAddress?: string) {
  const where = walletAddress ? { metadata: { contains: walletAddress } } : {};

  const activeProofs = await prisma.proof.count({
    where: { proofStatus: { in: ["PENDING", "GENERATED"] } },
  });

  const settledToday = await prisma.settlementTx.count({
    where: {
      settledAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });

  const verifiedProofs = await prisma.proof.findMany({
    where: { proofStatus: "VERIFIED", verificationTimeMs: { not: null } },
    select: { verificationTimeMs: true },
  });

  const avgProofTime =
    verifiedProofs.length > 0
      ? verifiedProofs.reduce((s: number, p: any) => s + (p.verificationTimeMs || 0), 0) /
        verifiedProofs.length /
        1000
      : 0;

  const totalProofs = await prisma.proof.count();
  const verifiedCount = await prisma.proof.count({
    where: { proofStatus: "VERIFIED" },
  });
  const successRate = totalProofs > 0 ? (verifiedCount / totalProofs) * 100 : 100;

  return {
    activeProofs,
    settledToday,
    avgProofTime: `${avgProofTime.toFixed(2)}s`,
    successRate: `${successRate.toFixed(1)}%`,
  };
}
