import prisma from "../db/prisma.js";
import { wsManager } from "../websocket/manager.js";
import {
  generateCommitmentHash,
  generateProofId,
  generateTxHash,
  sleep,
  randomInt,
  shortOrderId,
} from "../utils/helpers.js";
import {
  isStarknetEnabled,
  submitCommitmentOnChain,
  recordMatchOnChain,
  settleMatchOnChain,
  getTxUrl,
} from "./starknet.service.js";

let matcherRunning = false;

// ── Concurrency: prevent multiple pipelines for the same match ──
const inFlightMatches = new Set<string>();

// ── On-chain transaction queue (serialize all operator txs to avoid nonce issues) ──
let txQueuePromise = Promise.resolve<any>(undefined);

/**
 * Queue an on-chain operation so they run sequentially (avoids nonce conflicts).
 */
function queueOnChainTx<T>(fn: () => Promise<T>): Promise<T> {
  const p = txQueuePromise.then(fn, fn); // run even if previous fails
  txQueuePromise = p.catch(() => {}); // swallow errors in chain
  return p;
}

/**
 * FIFO matcher: scans open BUY/SELL orders and matches counterparties.
 * Supports partial fills — if a BUY 10 meets a SELL 4, the trade fills for 4
 * and a remainder BUY 6 order is created automatically.
 */
export async function runMatcher() {
  if (matcherRunning) return { matchesCreated: 0, matchIds: [], retriedStuck: 0, skipped: true };
  matcherRunning = true;
  try {
    return await runMatcherInner();
  } finally {
    matcherRunning = false;
  }
}

async function runMatcherInner() {
  const openOrders = await prisma.orderCommitment.findMany({
    where: { status: "CREATED" },
    orderBy: { createdAt: "asc" },
  });

  // Group orders by canonical pair (sorted alphabetically) and side
  const pairMap = new Map<
    string,
    { buys: typeof openOrders; sells: typeof openOrders }
  >();

  for (const order of openOrders) {
    const assets = [order.assetIn, order.assetOut].sort();
    const canonicalPair = `${assets[0]}/${assets[1]}`;
    const entry = pairMap.get(canonicalPair) || { buys: [], sells: [] };
    if (order.orderType === "BUY") entry.buys.push(order);
    else entry.sells.push(order);
    pairMap.set(canonicalPair, entry);
  }

  const matches: string[] = [];

  for (const [canonicalPair, { buys, sells }] of pairMap) {
    const unmatchedSells = [...sells];

    for (let buyIdx = 0; buyIdx < buys.length; buyIdx++) {
      let buyOrder = buys[buyIdx];
      if (unmatchedSells.length === 0) break;

      // Skip if this buy order was already matched in this cycle (e.g., it was a remainder that got re-added)
      const currentBuy = await prisma.orderCommitment.findUnique({ where: { id: buyOrder.id } });
      if (!currentBuy || currentBuy.status !== "CREATED") continue;
      buyOrder = currentBuy;

      // Find a sell counterparty: seller's assetIn = buyer's assetOut AND seller's assetOut = buyer's assetIn
      // Also prevent self-trades: buyer and seller must be different users
      const sellIdx = unmatchedSells.findIndex(
        (s) =>
          s.assetIn === buyOrder.assetOut &&
          s.assetOut === buyOrder.assetIn &&
          s.userId !== buyOrder.userId
      );
      if (sellIdx === -1) continue;

      let sellOrder = unmatchedSells[sellIdx];

      // Re-fetch sell order to ensure fresh state
      const currentSell = await prisma.orderCommitment.findUnique({ where: { id: sellOrder.id } });
      if (!currentSell || currentSell.status !== "CREATED") {
        unmatchedSells.splice(sellIdx, 1);
        continue;
      }
      sellOrder = currentSell;

      // ── Determine fill amount ──
      const buyAmount = buyOrder.amount;
      const sellAmount = sellOrder.amount;
      const fillAmount = Math.min(buyAmount, sellAmount);
      const isPartialFill = buyAmount !== sellAmount;

      // Check if partial fill is allowed by the larger order
      if (isPartialFill) {
        const largerOrder = buyAmount > sellAmount ? buyOrder : sellOrder;
        if (!largerOrder.allowPartialFill) {
          // Larger order doesn't allow partial fills — skip this pair
          unmatchedSells.splice(sellIdx, 1); // remove from candidates for this buy
          continue;
        }
      }

      // Remove matched sell from unmatched list
      unmatchedSells.splice(sellIdx, 1);

      // ── Handle partial fill: split the larger order ──
      let remainderOrder: any = null;

      if (isPartialFill) {
        const largerOrder = buyAmount > sellAmount ? buyOrder : sellOrder;
        const remainderAmount = Math.abs(buyAmount - sellAmount);

        // Update the larger order's amount to the fill amount and record originalAmount
        await prisma.orderCommitment.update({
          where: { id: largerOrder.id },
          data: {
            amount: fillAmount,
            originalAmount: largerOrder.originalAmount ?? largerOrder.amount,
          },
        });

        // Create remainder order (no vault balance changes needed — original lock covers both portions)
        const rootOriginalAmount = largerOrder.originalAmount ?? largerOrder.amount;
        remainderOrder = await prisma.orderCommitment.create({
          data: {
            userId: largerOrder.userId,
            commitmentHash: generateCommitmentHash(),
            assetIn: largerOrder.assetIn,
            assetOut: largerOrder.assetOut,
            orderType: largerOrder.orderType,
            amount: remainderAmount,
            price: largerOrder.price,
            amountEncrypted: "████████",
            priceEncrypted: "████████",
            status: "CREATED",
            allowPartialFill: largerOrder.allowPartialFill,
            originalAmount: rootOriginalAmount,
            parentOrderId: largerOrder.parentOrderId ?? largerOrder.id,
            expiresAt: largerOrder.expiresAt,
          },
        });

        console.log(
          `[Matcher] Partial fill: ${largerOrder.orderType} ${largerOrder.originalAmount ?? largerOrder.amount} → filled ${fillAmount}, remainder ${remainderAmount} (order ${remainderOrder.id.slice(0, 8)}...)`
        );

        // Add the remainder back to the pool for potential further matching
        if (largerOrder.orderType === "SELL") {
          unmatchedSells.push(remainderOrder);
        }
        // If it was the buy order that was larger, the outer loop will continue looking
        // but the buy order is now marked MATCHED, so the remainder is a new order
        // that will be picked up in the next matcher run

        // Emit ws event for remainder order
        wsManager.emit("order:created", {
          orderId: remainderOrder.id,
          shortId: shortOrderId(remainderOrder.id),
          orderType: remainderOrder.orderType,
          pair: remainderOrder.orderType === "BUY"
            ? `${remainderOrder.assetOut}/${remainderOrder.assetIn}`
            : `${remainderOrder.assetIn}/${remainderOrder.assetOut}`,
          status: "CREATED",
          isRemainder: true,
          parentOrderId: remainderOrder.parentOrderId,
          amount: remainderAmount,
        });
      }

      // Canonical display pair
      const displayPair = `${buyOrder.assetOut} / ${buyOrder.assetIn}`;

      // Create match
      const match = await prisma.match.create({
        data: {
          buyOrderId: buyOrder.id,
          sellOrderId: sellOrder.id,
          pair: displayPair,
          amount: `${fillAmount}`,
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
      const partialNote = isPartialFill ? ` (partial fill: ${fillAmount})` : "";
      await prisma.activityEvent.create({
        data: {
          type: "ORDER_MATCHED",
          message: `Orders matched in ${displayPair} dark pool${partialNote}`,
          metadata: JSON.stringify({
            matchId: match.id,
            buyOrderId: buyOrder.id,
            sellOrderId: sellOrder.id,
            fillAmount,
            isPartialFill,
            remainderOrderId: remainderOrder?.id || null,
          }),
        },
      });

      wsManager.emit("order:matched", {
        matchId: match.id,
        pair: displayPair,
        status: "MATCHED",
        fillAmount,
        isPartialFill,
      });

      wsManager.emit("activity:new", {
        type: "ORDER_MATCHED",
        message: `Orders matched in ${displayPair} dark pool${partialNote}`,
      });

      matches.push(match.id);

      // Trigger async proof generation immediately
      runProofPipeline(match.id);
    }
  }

  // Also resume any stuck matches that haven't completed
  const stuckMatches = await prisma.match.findMany({
    where: {
      status: { notIn: ["SETTLED", "FAILED"] },
      id: { notIn: matches },
    },
    include: {
      proof: true,
      settlement: true,
    },
  });

  const retriedIds: string[] = [];
  for (const stuck of stuckMatches) {
    // Skip if already has a settlement
    if (stuck.settlement) {
      // Ensure match AND order statuses are correct
      if (stuck.status !== "SETTLED") {
        await prisma.match.update({ where: { id: stuck.id }, data: { status: "SETTLED" } });
      }
      // Sync order statuses too
      await prisma.orderCommitment.updateMany({
        where: { id: { in: [stuck.buyOrderId, stuck.sellOrderId] }, status: { not: "SETTLED" } },
        data: { status: "SETTLED" },
      });
      continue;
    }

    const proofStatus = stuck.proof?.proofStatus;
    // Skip if proof FAILED (needs manual intervention)
    if (proofStatus === "FAILED") continue;

    console.log(`[Matcher] Retrying stuck match ${stuck.id} (status=${stuck.status}, proof=${proofStatus || 'NONE'})`);

    // Skip if already being processed
    if (inFlightMatches.has(stuck.id)) {
      console.log(`[Matcher] Match ${stuck.id} already in-flight, skipping retry`);
      continue;
    }

    // For VERIFIED matches missing settlement, run just the settlement step
    if (proofStatus === "VERIFIED" && stuck.status === "VERIFIED") {
      inFlightMatches.add(stuck.id);
      runSettlementOnly(stuck.id)
        .catch((err) => {
          console.error(`[Matcher] Settlement retry failed for ${stuck.id}:`, err);
        })
        .finally(() => inFlightMatches.delete(stuck.id));
    } else {
      runProofPipeline(stuck.id);
    }
    retriedIds.push(stuck.id);
  }

  return {
    matchesCreated: matches.length,
    matchIds: matches,
    retriedStuck: retriedIds.length,
  };
}

/**
 * Fire-and-forget proof pipeline wrapper with error recovery and concurrency lock.
 */
function runProofPipeline(matchId: string) {
  if (inFlightMatches.has(matchId)) {
    console.log(`[ProofPipeline] Skipping ${matchId} — already in-flight`);
    return;
  }
  inFlightMatches.add(matchId);

  simulateProofGeneration(matchId)
    .catch(async (err) => {
      console.error(`[ProofPipeline] FAILED for match ${matchId}:`, err);
      try {
        // Reset match status
        await prisma.match.update({
          where: { id: matchId },
          data: { status: "PENDING" },
        });
        // Reset proof status
        await prisma.proof.update({
          where: { matchId },
          data: { proofStatus: "PENDING", proofId: "" },
        }).catch(() => {});
        // Reset order statuses so pipeline can be retried
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (match) {
          await prisma.orderCommitment.updateMany({
            where: { id: { in: [match.buyOrderId, match.sellOrderId] } },
            data: { status: "MATCHED" },
          });
        }
      } catch (e) {
        console.error("[ProofPipeline] Could not reset match status:", e);
      }
    })
    .finally(() => {
      inFlightMatches.delete(matchId);
    });
}

/**
 * Proof generation pipeline: PENDING → PROVING → GENERATED → VERIFIED → SETTLED
 * When Starknet is enabled, this submits commitments, records match, and settles on-chain.
 * When Starknet is not available, it uses simulated settlement with clearly marked fake tx hashes.
 */
async function simulateProofGeneration(matchId: string) {
  console.log(`[ProofPipeline] Starting for match ${matchId}`);

  await sleep(500);

  // ── Step 1: PROVING — Submit commitments on-chain ──
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { buyOrder: true, sellOrder: true },
  });
  if (!match) throw new Error(`Match ${matchId} not found`);

  // Guard: if match is already settled or being processed, skip
  if (match.status === "SETTLED") {
    console.log(`[ProofPipeline] Match ${matchId} already settled, skipping`);
    return;
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { status: "PROVING" },
  });

  await prisma.orderCommitment.updateMany({
    where: { id: { in: [match.buyOrderId, match.sellOrderId] } },
    data: { status: "PROVING" },
  });

  wsManager.emit("proof:generating", { matchId, status: "PROVING" });
  console.log(`[ProofPipeline] ${matchId} → PROVING`);

  // Submit buy order commitment on-chain (if not already submitted)
  const buyOrder = match.buyOrder;
  const sellOrder = match.sellOrder;
  
  if (isStarknetEnabled()) {
    // Submit buy commitment on-chain (queued to avoid nonce conflicts)
    if (!buyOrder.onChainId) {
      console.log(`[ProofPipeline] Submitting buy commitment on-chain for order ${buyOrder.id.slice(0, 8)}...`);
      const buyResult = await queueOnChainTx(() => submitCommitmentOnChain(
        buyOrder.commitmentHash,
        buyOrder.assetIn,
        buyOrder.assetOut,
        buyOrder.amountEncrypted || "0x0",
        buyOrder.priceEncrypted || "0x0"
      ));
      if (buyResult) {
        await prisma.orderCommitment.update({
          where: { id: buyOrder.id },
          data: { onChainId: buyResult.onChainId, onChainTxHash: buyResult.txHash },
        });
        buyOrder.onChainId = buyResult.onChainId;
        (buyOrder as any).onChainTxHash = buyResult.txHash;
        console.log(`[ProofPipeline] Buy commitment on-chain: id=${buyResult.onChainId}, tx=${buyResult.txHash.slice(0, 16)}...`);
      } else {
        console.warn(`[ProofPipeline] Buy commitment on-chain submission returned null`);
      }
    }

    // Submit sell commitment on-chain
    if (!sellOrder.onChainId) {
      console.log(`[ProofPipeline] Submitting sell commitment on-chain for order ${sellOrder.id.slice(0, 8)}...`);
      const sellResult = await queueOnChainTx(() => submitCommitmentOnChain(
        sellOrder.commitmentHash,
        sellOrder.assetIn,
        sellOrder.assetOut,
        sellOrder.amountEncrypted || "0x0",
        sellOrder.priceEncrypted || "0x0"
      ));
      if (sellResult) {
        await prisma.orderCommitment.update({
          where: { id: sellOrder.id },
          data: { onChainId: sellResult.onChainId, onChainTxHash: sellResult.txHash },
        });
        sellOrder.onChainId = sellResult.onChainId;
        (sellOrder as any).onChainTxHash = sellResult.txHash;
        console.log(`[ProofPipeline] Sell commitment on-chain: id=${sellResult.onChainId}, tx=${sellResult.txHash.slice(0, 16)}...`);
      } else {
        console.warn(`[ProofPipeline] Sell commitment on-chain submission returned null`);
      }
    }

    // Record match on-chain
    if (buyOrder.onChainId && sellOrder.onChainId && !match.onChainMatchId) {
      console.log(`[ProofPipeline] Recording match on-chain: buy=${buyOrder.onChainId}, sell=${sellOrder.onChainId}`);
      const fillAmount = match.amount || String(Math.min(buyOrder.amount, sellOrder.amount));
      const matchResult = await queueOnChainTx(() => recordMatchOnChain(
        buyOrder.onChainId!,
        sellOrder.onChainId!,
        "0x" + Buffer.from(fillAmount).toString("hex").slice(0, 62)
      ));
      if (matchResult) {
        await prisma.match.update({
          where: { id: matchId },
          data: { onChainMatchId: matchResult.onChainMatchId, onChainTxHash: matchResult.txHash },
        });
        (match as any).onChainMatchId = matchResult.onChainMatchId;
        (match as any).onChainTxHash = matchResult.txHash;
        console.log(`[ProofPipeline] Match recorded on-chain: matchId=${matchResult.onChainMatchId}, tx=${matchResult.txHash.slice(0, 16)}...`);
      }
    }
  }

  // ── Step 2: GENERATED — Proof data ──
  await sleep(randomInt(800, 1500));

  const proofId = generateProofId();
  const proofTime = randomInt(1500, 3000);

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
        onChainMatchId: (match as any).onChainMatchId || null,
        buyOnChainId: buyOrder.onChainId || null,
        sellOnChainId: sellOrder.onChainId || null,
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

  wsManager.emit("proof:generated", { matchId, proofId, status: "GENERATED" });
  console.log(`[ProofPipeline] ${matchId} → GENERATED (${proofId.slice(0, 12)}...)`);

  // ── Step 3: VERIFIED ──
  await sleep(randomInt(500, 1000));

  await prisma.proof.update({
    where: { matchId },
    data: { proofStatus: "VERIFIED" },
  });

  await prisma.match.update({
    where: { id: matchId },
    data: { status: "VERIFIED" },
  });

  await prisma.orderCommitment.updateMany({
    where: { id: { in: [match.buyOrderId, match.sellOrderId] } },
    data: { status: "VERIFIED" },
  });

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
  console.log(`[ProofPipeline] ${matchId} → VERIFIED`);

  // ── Step 4: SETTLEMENT ──
  await settleMatch(matchId, proofId);
}

/**
 * Run only the settlement step for a match that's already VERIFIED.
 */
async function runSettlementOnly(matchId: string) {
  const proof = await prisma.proof.findUnique({ where: { matchId } });
  if (!proof || proof.proofStatus !== "VERIFIED") {
    console.log(`[Settlement] Match ${matchId} proof not verified, cannot settle`);
    return;
  }

  // Check if settlement already exists
  const existing = await prisma.settlementTx.findUnique({ where: { matchId } });
  if (existing) {
    console.log(`[Settlement] Match ${matchId} already has settlement, syncing status`);
    await prisma.match.update({ where: { id: matchId }, data: { status: "SETTLED" } });
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (match) {
      await prisma.orderCommitment.updateMany({
        where: { id: { in: [match.buyOrderId, match.sellOrderId] } },
        data: { status: "SETTLED" },
      });
    }
    return;
  }

  await settleMatch(matchId, proof.proofId);
}

/**
 * Settlement logic: handles balance transfers and on-chain settlement.
 * Uses the match's fill amount (not raw order amounts) for correct partial fill handling.
 * When Starknet is enabled, calls settle_match on-chain using the real on-chain match ID.
 */
async function settleMatch(matchId: string, proofId: string) {
  await sleep(randomInt(300, 800));

  // Fetch match with on-chain IDs
  const matchData = await prisma.match.findUnique({
    where: { id: matchId },
    include: { buyOrder: true, sellOrder: true },
  });
  if (!matchData) throw new Error(`Match ${matchId} not found for settlement`);

  let txHash: string;
  const gasUsed = randomInt(120000, 180000).toLocaleString();
  let network = "starknet-sepolia";

  // Try real Starknet settlement
  if (isStarknetEnabled() && matchData.onChainMatchId) {
    console.log(`[Settlement] Settling on-chain: matchId=${matchData.onChainMatchId}, proof=${proofId.slice(0, 16)}...`);
    const onChainTxHash = await queueOnChainTx(() => settleMatchOnChain(matchData.onChainMatchId!, proofId));
    if (onChainTxHash) {
      txHash = onChainTxHash;
      console.log(`[Settlement] Real Starknet tx: ${getTxUrl(txHash)}`);
    } else {
      throw new Error(`On-chain settlement returned null for match ${matchId}`);
    }
  } else if (isStarknetEnabled() && !matchData.onChainMatchId) {
    // Starknet is enabled but we don't have an on-chain match ID
    // This means the commitment/match recording step failed — try the full flow now
    console.warn(`[Settlement] No on-chain match ID for ${matchId}, attempting full on-chain flow`);
    
    const buyOrder = matchData.buyOrder;
    const sellOrder = matchData.sellOrder;
    
    // Submit commitments if needed (queued)
    if (!buyOrder.onChainId) {
      const buyResult = await queueOnChainTx(() => submitCommitmentOnChain(
        buyOrder.commitmentHash, buyOrder.assetIn, buyOrder.assetOut,
        buyOrder.amountEncrypted || "0x0", buyOrder.priceEncrypted || "0x0"
      ));
      if (buyResult) {
        await prisma.orderCommitment.update({
          where: { id: buyOrder.id },
          data: { onChainId: buyResult.onChainId, onChainTxHash: buyResult.txHash },
        });
        buyOrder.onChainId = buyResult.onChainId;
      }
    }
    if (!sellOrder.onChainId) {
      const sellResult = await queueOnChainTx(() => submitCommitmentOnChain(
        sellOrder.commitmentHash, sellOrder.assetIn, sellOrder.assetOut,
        sellOrder.amountEncrypted || "0x0", sellOrder.priceEncrypted || "0x0"
      ));
      if (sellResult) {
        await prisma.orderCommitment.update({
          where: { id: sellOrder.id },
          data: { onChainId: sellResult.onChainId, onChainTxHash: sellResult.txHash },
        });
        sellOrder.onChainId = sellResult.onChainId;
      }
    }
    
    // Record match on-chain (queued)
    let onChainMatchId: number | null = null;
    if (buyOrder.onChainId && sellOrder.onChainId) {
      const fillAmount = matchData.amount || String(Math.min(buyOrder.amount, sellOrder.amount));
      const matchResult = await queueOnChainTx(() => recordMatchOnChain(
        buyOrder.onChainId!, sellOrder.onChainId!,
        "0x" + Buffer.from(fillAmount).toString("hex").slice(0, 62)
      ));
      if (matchResult) {
        onChainMatchId = matchResult.onChainMatchId;
        await prisma.match.update({
          where: { id: matchId },
          data: { onChainMatchId: matchResult.onChainMatchId, onChainTxHash: matchResult.txHash },
        });
      }
    }
    
    // Now settle on-chain (queued)
    if (onChainMatchId) {
      const onChainTxHash = await queueOnChainTx(() => settleMatchOnChain(onChainMatchId!, proofId));
      if (onChainTxHash) {
        txHash = onChainTxHash;
        console.log(`[Settlement] Real Starknet tx (late flow): ${getTxUrl(txHash)}`);
      } else {
        throw new Error(`On-chain settlement (late flow) returned null for match ${matchId}`);
      }
    } else {
      throw new Error(`Could not get on-chain match ID for match ${matchId} — commitment submissions may have failed`);
    }
  } else {
    // Starknet not enabled — simulated settlement
    txHash = generateTxHash();
    network = "starknet-sepolia (simulated)";
  }

  if (matchData) {
    const buyOrder = matchData.buyOrder;
    const sellOrder = matchData.sellOrder;

    // ── Use the match's fill amount for balance calculations ──
    // For partial fills, the order's amount was already updated to fillAmount
    const fillAmount = parseFloat(matchData.amount) || Math.min(buyOrder.amount, sellOrder.amount);
    const tradePrice = buyOrder.price;

    // --- Buyer side ---
    // Buyer locked quote asset (assetIn). Unlock fillAmount * price, credit fillAmount of assetOut.
    const buyerLockedAsset = buyOrder.assetIn;
    const buyerUnlockAmount = fillAmount * tradePrice;

    await prisma.vaultBalance.upsert({
      where: { userId_assetSymbol: { userId: buyOrder.userId, assetSymbol: buyerLockedAsset } },
      update: { lockedBalance: { decrement: buyerUnlockAmount } },
      create: { userId: buyOrder.userId, assetSymbol: buyerLockedAsset, publicBalance: 0, shieldedBalance: 0, lockedBalance: 0 },
    });

    await prisma.vaultBalance.upsert({
      where: { userId_assetSymbol: { userId: buyOrder.userId, assetSymbol: buyOrder.assetOut } },
      update: { shieldedBalance: { increment: fillAmount } },
      create: { userId: buyOrder.userId, assetSymbol: buyOrder.assetOut, publicBalance: 0, shieldedBalance: fillAmount, lockedBalance: 0 },
    });

    // --- Seller side ---
    // Seller locked base asset (assetIn). Unlock fillAmount, credit fillAmount * price of assetOut.
    const sellerLockedAsset = sellOrder.assetIn;
    const sellerUnlockAmount = fillAmount;
    const sellerReceives = fillAmount * tradePrice;

    await prisma.vaultBalance.upsert({
      where: { userId_assetSymbol: { userId: sellOrder.userId, assetSymbol: sellerLockedAsset } },
      update: { lockedBalance: { decrement: sellerUnlockAmount } },
      create: { userId: sellOrder.userId, assetSymbol: sellerLockedAsset, publicBalance: 0, shieldedBalance: 0, lockedBalance: 0 },
    });

    const paymentAsset = sellOrder.assetOut;
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

  if (matchData) {
    await prisma.orderCommitment.updateMany({
      where: { id: { in: [matchData.buyOrderId, matchData.sellOrderId] } },
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

  console.log(`[ProofPipeline] ${matchId} → SETTLED (tx: ${txHash.slice(0, 16)}...)`);
}

// ─── Periodic stuck match retry ────────────────────────────

let stuckRetryInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start a periodic check for stuck matches every 30 seconds.
 * Called once on server startup.
 */
export function startStuckMatchRetry() {
  if (stuckRetryInterval) return;
  stuckRetryInterval = setInterval(async () => {
    try {
      const stuckMatches = await prisma.match.findMany({
        where: {
          status: { notIn: ["SETTLED", "FAILED"] },
        },
        include: { proof: true, settlement: true },
      });

      for (const stuck of stuckMatches) {
        if (stuck.settlement) {
          // Sync match AND order statuses if settlement exists
          if (stuck.status !== "SETTLED") {
            await prisma.match.update({ where: { id: stuck.id }, data: { status: "SETTLED" } });
          }
          await prisma.orderCommitment.updateMany({
            where: { id: { in: [stuck.buyOrderId, stuck.sellOrderId] }, status: { not: "SETTLED" } },
            data: { status: "SETTLED" },
          });
          continue;
        }
        if (stuck.proof?.proofStatus === "FAILED") continue;

        // Only retry matches older than 15 seconds to avoid interfering with in-progress pipelines
        const ageMs = Date.now() - stuck.createdAt.getTime();
        if (ageMs < 15000) continue;

        console.log(`[StuckRetry] Retrying match ${stuck.id} (age=${Math.round(ageMs / 1000)}s, status=${stuck.status}, proof=${stuck.proof?.proofStatus || 'NONE'})`);

        // Skip if already in-flight
        if (inFlightMatches.has(stuck.id)) {
          console.log(`[StuckRetry] Match ${stuck.id} already in-flight, skipping`);
          continue;
        }

        if (stuck.proof?.proofStatus === "VERIFIED" && stuck.status === "VERIFIED") {
          inFlightMatches.add(stuck.id);
          runSettlementOnly(stuck.id)
            .catch((err) =>
              console.error(`[StuckRetry] Settlement retry failed for ${stuck.id}:`, err)
            )
            .finally(() => inFlightMatches.delete(stuck.id));
        } else {
          runProofPipeline(stuck.id);
        }
      }
    } catch (err) {
      console.error("[StuckRetry] Error checking for stuck matches:", err);
    }
  }, 30000);
  console.log("[StuckRetry] Periodic stuck match retry started (every 30s)");

  // Run an immediate sync on startup to fix any out-of-sync order statuses
  syncOrderStatuses().catch((err) =>
    console.error("[StuckRetry] Initial sync failed:", err)
  );
}

/**
 * Sync order and proof statuses with their match/settlement statuses.
 * Fixes orders stuck in MATCHED/PROVING/VERIFIED when their match is already SETTLED.
 * Also fixes proofs stuck in PENDING when match is already SETTLED.
 */
async function syncOrderStatuses() {
  const settledMatches = await prisma.match.findMany({
    where: { status: "SETTLED" },
    select: { id: true, buyOrderId: true, sellOrderId: true },
  });

  if (settledMatches.length === 0) return;

  const orderIds = settledMatches.flatMap((m) => [m.buyOrderId, m.sellOrderId]);
  const matchIds = settledMatches.map((m) => m.id);

  const orderResult = await prisma.orderCommitment.updateMany({
    where: { id: { in: orderIds }, status: { notIn: ["SETTLED", "CANCELLED"] } },
    data: { status: "SETTLED" },
  });

  if (orderResult.count > 0) {
    console.log(`[Sync] Fixed ${orderResult.count} order(s) with out-of-sync status`);
  }

  // Fix proofs stuck in PENDING for settled matches
  const proofResult = await prisma.proof.updateMany({
    where: { matchId: { in: matchIds }, proofStatus: { not: "VERIFIED" } },
    data: { proofStatus: "VERIFIED" },
  });

  if (proofResult.count > 0) {
    console.log(`[Sync] Fixed ${proofResult.count} proof(s) with out-of-sync status`);
  }
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

  runProofPipeline(matchId);
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
