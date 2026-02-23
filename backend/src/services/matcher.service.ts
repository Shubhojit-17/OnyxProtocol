import prisma from "../db/prisma.js";
import { wsManager } from "../websocket/manager.js";
import {
  generateProofId,
  generateTxHash,
  sleep,
  randomInt,
} from "../utils/helpers.js";
import {
  isStarknetEnabled,
  recordMatchOnChain,
  settleMatchOnChain,
  getTxUrl,
} from "./starknet.service.js";

/**
 * FIFO matcher: scans open BUY/SELL orders for each pair and matches them.
 */
export async function runMatcher() {
  const openOrders = await prisma.orderCommitment.findMany({
    where: { status: "CREATED" },
    orderBy: { createdAt: "asc" },
  });

  // Group by pair
  const pairMap = new Map<
    string,
    { buys: typeof openOrders; sells: typeof openOrders }
  >();

  for (const order of openOrders) {
    const pair = `${order.assetIn}/${order.assetOut}`;
    const entry = pairMap.get(pair) || { buys: [], sells: [] };
    if (order.orderType === "BUY") entry.buys.push(order);
    else entry.sells.push(order);
    pairMap.set(pair, entry);
  }

  const matches: string[] = [];

  for (const [pair, { buys, sells }] of pairMap) {
    const count = Math.min(buys.length, sells.length);
    for (let i = 0; i < count; i++) {
      const buyOrder = buys[i];
      const sellOrder = sells[i];

      // Create match
      const match = await prisma.match.create({
        data: {
          buyOrderId: buyOrder.id,
          sellOrderId: sellOrder.id,
          pair,
          amount: `${Math.min(buyOrder.amount, sellOrder.amount)}`,
          status: "PENDING",
        },
      });

      // Update order statuses
      await prisma.orderCommitment.updateMany({
        where: { id: { in: [buyOrder.id, sellOrder.id] } },
        data: { status: "MATCHED" },
      });

      // Create proof record
      await prisma.proof.create({
        data: {
          matchId: match.id,
          proofId: "",
          proofStatus: "PENDING",
        },
      });

      // Activity
      await prisma.activityEvent.create({
        data: {
          type: "ORDER_MATCHED",
          message: `Orders matched in ${pair} dark pool`,
          metadata: JSON.stringify({
            matchId: match.id,
            buyOrderId: buyOrder.id,
            sellOrderId: sellOrder.id,
          }),
        },
      });

      wsManager.emit("order:matched", {
        matchId: match.id,
        pair,
        status: "MATCHED",
      });

      wsManager.emit("activity:new", {
        type: "ORDER_MATCHED",
        message: `Orders matched in ${pair} dark pool`,
      });

      matches.push(match.id);

      // Trigger async proof generation
      simulateProofGeneration(match.id).catch(console.error);
    }
  }

  return { matchesCreated: matches.length, matchIds: matches };
}

/**
 * Simulated async proof generation pipeline.
 * PENDING -> GENERATED -> VERIFIED, with settlement on verify.
 */
async function simulateProofGeneration(matchId: string) {
  await sleep(randomInt(1000, 2000));

  // Update match status to PROVING
  await prisma.match.update({
    where: { id: matchId },
    data: { status: "PROVING" },
  });

  // Update orders to PROVING
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (match) {
    await prisma.orderCommitment.updateMany({
      where: { id: { in: [match.buyOrderId, match.sellOrderId] } },
      data: { status: "PROVING" },
    });
  }

  wsManager.emit("proof:generating", { matchId, status: "PROVING" });

  // Simulate proof generation (2-5 seconds)
  const proofTime = randomInt(2000, 5000);
  await sleep(proofTime);

  const proofId = generateProofId();

  // GENERATED
  await prisma.proof.update({
    where: { matchId },
    data: {
      proofId,
      proofStatus: "GENERATED",
      verificationTimeMs: proofTime,
      proofSize: `${(Math.random() * 3 + 2).toFixed(1)} KB`,
      metadataJson: JSON.stringify({
        circuit: "onyx_dark_pool_v1",
        prover: "stone-prover",
        timestamp: new Date().toISOString(),
      }),
    },
  });

  await prisma.activityEvent.create({
    data: {
      type: "PROOF_GENERATED",
      message: `ZK proof generated for match`,
      metadata: JSON.stringify({ matchId, proofId }),
    },
  });

  // Short delay then verify
  await sleep(randomInt(500, 1500));

  // VERIFIED
  await prisma.proof.update({
    where: { matchId },
    data: { proofStatus: "VERIFIED" },
  });

  await prisma.match.update({
    where: { id: matchId },
    data: { status: "VERIFIED" },
  });

  if (match) {
    await prisma.orderCommitment.updateMany({
      where: { id: { in: [match.buyOrderId, match.sellOrderId] } },
      data: { status: "VERIFIED" },
    });
  }

  await prisma.activityEvent.create({
    data: {
      type: "PROOF_VERIFIED",
      message: `Proof verified for match`,
      metadata: JSON.stringify({ matchId, proofId }),
    },
  });

  wsManager.emit("proof:verified", { matchId, proofId, status: "VERIFIED" });
  wsManager.emit("activity:new", {
    type: "PROOF_VERIFIED",
    message: `Proof verified for match`,
  });

  // Settlement
  await sleep(randomInt(500, 1000));

  let txHash: string;
  const gasUsed = randomInt(120000, 180000).toLocaleString();
  let network = "starknet-sepolia";

  // --- Try real Starknet settlement ---
  if (isStarknetEnabled()) {
    try {
      const onChainTxHash = await settleMatchOnChain(
        1, // In production, this would be the on-chain match ID
        proofId
      );
      if (onChainTxHash) {
        txHash = onChainTxHash;
        console.log(`[Settlement] Real Starknet tx: ${getTxUrl(txHash)}`);
      } else {
        txHash = generateTxHash();
        network = "starknet-sepolia (simulated)";
      }
    } catch (err) {
      console.error("[Settlement] On-chain settlement failed, using simulated:", err);
      txHash = generateTxHash();
      network = "starknet-sepolia (simulated)";
    }
  } else {
    txHash = generateTxHash();
    network = "starknet-sepolia (simulated)";
  }

  // Fetch the full match with both orders to settle balances
  const fullMatch = await prisma.match.findUnique({
    where: { id: matchId },
    include: { buyOrder: true, sellOrder: true },
  });

  if (fullMatch) {
    const buyOrder = fullMatch.buyOrder;
    const sellOrder = fullMatch.sellOrder;
    const tradeAmount = Math.min(buyOrder.amount, sellOrder.amount);
    const tradePrice = buyOrder.price; // Use buyer's price

    // --- Buyer side ---
    // Buyer locked quote asset (amount * price) when creating the order.
    // Now: release locked quote, credit buyer with the purchased asset (shielded).
    const buyerLockedAsset = buyOrder.assetOut;
    const buyerLockedAmount = buyOrder.amount * buyOrder.price;

    // Release buyer's locked quote asset
    await prisma.vaultBalance.upsert({
      where: { userId_assetSymbol: { userId: buyOrder.userId, assetSymbol: buyerLockedAsset } },
      update: { lockedBalance: { decrement: buyerLockedAmount } },
      create: { userId: buyOrder.userId, assetSymbol: buyerLockedAsset, publicBalance: 0, shieldedBalance: 0, lockedBalance: 0 },
    });

    // Credit buyer with the asset they bought (into shielded balance)
    await prisma.vaultBalance.upsert({
      where: { userId_assetSymbol: { userId: buyOrder.userId, assetSymbol: buyOrder.assetIn } },
      update: { shieldedBalance: { increment: tradeAmount } },
      create: { userId: buyOrder.userId, assetSymbol: buyOrder.assetIn, publicBalance: 0, shieldedBalance: tradeAmount, lockedBalance: 0 },
    });

    // --- Seller side ---
    // Seller locked the asset (e.g., STRK) when creating the order.
    // Now: release locked asset, credit seller with payment (quote asset, shielded).
    const sellerLockedAsset = sellOrder.assetIn;
    const sellerLockedAmount = sellOrder.amount;
    const sellerReceives = tradeAmount * tradePrice; // quote asset equivalent

    // Release seller's locked asset
    await prisma.vaultBalance.upsert({
      where: { userId_assetSymbol: { userId: sellOrder.userId, assetSymbol: sellerLockedAsset } },
      update: { lockedBalance: { decrement: sellerLockedAmount } },
      create: { userId: sellOrder.userId, assetSymbol: sellerLockedAsset, publicBalance: 0, shieldedBalance: 0, lockedBalance: 0 },
    });

    // Credit seller with quote asset payment (into shielded balance)
    const paymentAsset = sellOrder.assetOut; // e.g. "ETH"
    await prisma.vaultBalance.upsert({
      where: { userId_assetSymbol: { userId: sellOrder.userId, assetSymbol: paymentAsset } },
      update: { shieldedBalance: { increment: sellerReceives } },
      create: { userId: sellOrder.userId, assetSymbol: paymentAsset, publicBalance: 0, shieldedBalance: sellerReceives, lockedBalance: 0 },
    });
  }

  await prisma.settlementTx.create({
    data: {
      matchId,
      txHash,
      network,
      gasUsed,
    },
  });

  await prisma.match.update({
    where: { id: matchId },
    data: { status: "SETTLED" },
  });

  if (fullMatch) {
    await prisma.orderCommitment.updateMany({
      where: { id: { in: [fullMatch.buyOrderId, fullMatch.sellOrderId] } },
      data: { status: "SETTLED" },
    });
  }

  await prisma.activityEvent.create({
    data: {
      type: "TRADE_SETTLED",
      message: `Trade settled on Starknet`,
      metadata: JSON.stringify({ matchId, txHash }),
    },
  });

  wsManager.emit("settlement:confirmed", {
    matchId,
    txHash,
    gasUsed,
    status: "SETTLED",
  });

  wsManager.emit("vault:updated", {
    matchId,
    message: "Balances updated after settlement",
  });

  wsManager.emit("activity:new", {
    type: "TRADE_SETTLED",
    message: `Trade settled on-chain: ${txHash.slice(0, 10)}...`,
  });
}

/**
 * Manually trigger proof generation for a specific match.
 */
export async function generateProof(matchId: string) {
  const proof = await prisma.proof.findUnique({ where: { matchId } });
  if (!proof) throw new Error("No proof record for this match");
  if (proof.proofStatus !== "PENDING") {
    throw new Error(`Proof already in status: ${proof.proofStatus}`);
  }

  // Trigger async
  simulateProofGeneration(matchId).catch(console.error);
  return { matchId, status: "PROVING", message: "Proof generation started" };
}

/**
 * Get proof status for a match.
 */
export async function getProofStatus(matchId: string) {
  const proof = await prisma.proof.findUnique({
    where: { matchId },
    include: { match: { include: { settlement: true } } },
  });
  if (!proof) throw new Error("Proof not found");

  return {
    matchId,
    proofId: proof.proofId,
    proofStatus: proof.proofStatus,
    verificationTimeMs: proof.verificationTimeMs,
    proofSize: proof.proofSize,
    verifier: proof.verifier,
    metadata: proof.metadataJson ? JSON.parse(proof.metadataJson) : null,
    settlement: proof.match.settlement
      ? {
          txHash: proof.match.settlement.txHash,
          gasUsed: proof.match.settlement.gasUsed,
          network: proof.match.settlement.network,
          settledAt: proof.match.settlement.settledAt.toISOString(),
        }
      : null,
  };
}
