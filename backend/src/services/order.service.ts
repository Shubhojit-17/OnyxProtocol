import prisma from "../db/prisma.js";
import { wsManager } from "../websocket/manager.js";
import {
  generateCommitmentHash,
  shortOrderId,
} from "../utils/helpers.js";

export async function createOrder(params: {
  walletAddress: string;
  assetIn: string;
  assetOut: string;
  orderType: "BUY" | "SELL";
  amount: number;
  price: number;
  commitmentHash?: string;
  expiresAt?: string;
  allowPartialFill?: boolean;
  allowCrossPair?: boolean;
}) {
  const user = await prisma.user.findUnique({
    where: { walletAddress: params.walletAddress },
  });
  if (!user) throw new Error("User not found");

  const hash = params.commitmentHash || generateCommitmentHash();

  // BUY: user spends assetIn (ETH) to get assetOut (STRK) → lock ETH = amount × price
  // SELL: user spends assetIn (STRK) to get assetOut (ETH) → lock STRK = amount
  const lockAsset = params.assetIn; // always lock what you're spending
  const lockAmount = params.orderType === "BUY" ? params.amount * params.price : params.amount;

  // Check shielded balance — enforce sufficient funds
  const balance = await prisma.vaultBalance.findUnique({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol: lockAsset } },
  });

  const available = balance ? Number(balance.shieldedBalance) : 0;
  if (available < lockAmount) {
    throw new Error(
      `Insufficient shielded balance: you have ${available.toFixed(6)} ${lockAsset} but need ${lockAmount.toFixed(6)} ${lockAsset}. Deposit and shield funds in the Vault first.`
    );
  }

  await prisma.vaultBalance.update({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol: lockAsset } },
    data: {
      shieldedBalance: { decrement: lockAmount },
      lockedBalance: { increment: lockAmount },
    },
  });

  const order = await prisma.orderCommitment.create({
    data: {
      userId: user.id,
      commitmentHash: hash,
      assetIn: params.assetIn,
      assetOut: params.assetOut,
      orderType: params.orderType,
      amount: params.amount,
      price: params.price,
      amountEncrypted: "████████",
      priceEncrypted: "████████",
      status: "CREATED",
      allowPartialFill: params.allowPartialFill ?? true,
      allowCrossPair: params.allowCrossPair ?? false,
      expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
    },
  });

  // Show canonical pair: for BUY, assetOut is base; for SELL, assetIn is base
  const displayPair = params.orderType === 'BUY'
    ? `${params.assetOut}/${params.assetIn}`
    : `${params.assetIn}/${params.assetOut}`;

  await prisma.activityEvent.create({
    data: {
      type: "ORDER_CREATED",
      message: `New order committed: ${params.orderType} ${displayPair}`,
      metadata: JSON.stringify({
        orderId: order.id,
        walletAddress: params.walletAddress,
        pair: displayPair,
      }),
    },
  });

  wsManager.emit("order:created", {
    orderId: order.id,
    shortId: shortOrderId(order.id),
    orderType: params.orderType,
    pair: displayPair,
    commitmentHash: hash,
    status: "CREATED",
  });

  wsManager.emit("activity:new", {
    type: "ORDER_CREATED",
    message: `New order committed: ${params.orderType} ${displayPair}`,
  });

  return {
    ...order,
    shortId: shortOrderId(order.id),
  };
}

export async function listOrders(walletAddress: string) {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
  });
  if (!user) return [];

  const orders = await prisma.orderCommitment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      buyMatch: { include: { proof: true, settlement: true } },
      sellMatch: { include: { proof: true, settlement: true } },
    },
  });

  return orders.map((o: any) => ({
    id: o.id,
    shortId: shortOrderId(o.id),
    pair: o.orderType === 'BUY' ? `${o.assetOut} / ${o.assetIn}` : `${o.assetIn} / ${o.assetOut}`,
    orderType: o.orderType,
    amount: o.amount,
    originalAmount: o.originalAmount,
    isPartialFill: o.originalAmount != null && o.originalAmount !== o.amount,
    parentOrderId: o.parentOrderId,
    allowPartialFill: o.allowPartialFill,
    allowCrossPair: o.allowCrossPair,
    price: o.price,
    status: o.status,
    commitmentHash: o.commitmentHash,
    createdAt: o.createdAt.toISOString(),
    expiresAt: o.expiresAt?.toISOString() ?? null,
    match: o.buyMatch || o.sellMatch || null,
  }));
}

export async function getOrderPool() {
  const openOrders = await prisma.orderCommitment.findMany({
    where: { status: "CREATED" },
    select: {
      assetIn: true,
      assetOut: true,
      orderType: true,
      createdAt: true,
    },
  });

  // Aggregate by canonical pair (sorted alphabetically)
  const pairMap = new Map<string, { buys: number; sells: number }>();
  for (const order of openOrders) {
    const assets = [order.assetIn, order.assetOut].sort();
    const canonicalPair = `${assets[0]}/${assets[1]}`;
    const entry = pairMap.get(canonicalPair) || { buys: 0, sells: 0 };
    if (order.orderType === "BUY") entry.buys++;
    else entry.sells++;
    pairMap.set(canonicalPair, entry);
  }

  return {
    totalOpenOrders: openOrders.length,
    pairs: Array.from(pairMap.entries()).map(([pair, counts]) => ({
      pair,
      buys: counts.buys,
      sells: counts.sells,
      total: counts.buys + counts.sells,
    })),
  };
}

/**
 * Cancel/delete an order. Only orders in CREATED status can be cancelled.
 * Matched/settled orders cannot be cancelled.
 * Releases the locked balance back to the user's shielded balance.
 */
export async function cancelOrder(params: { walletAddress: string; orderId: string }) {
  const user = await prisma.user.findUnique({
    where: { walletAddress: params.walletAddress },
  });
  if (!user) throw new Error("User not found");

  const order = await prisma.orderCommitment.findUnique({
    where: { id: params.orderId },
  });
  if (!order) throw new Error("Order not found");
  if (order.userId !== user.id) throw new Error("Not your order");
  if (order.status !== "CREATED") {
    throw new Error(`Cannot cancel order in status: ${order.status}. Only open orders can be cancelled.`);
  }

  // Calculate the locked amount to release
  // BUY: locked amount = amount * price (quote asset / assetIn)
  // SELL: locked amount = amount (base asset / assetIn)
  const lockAsset = order.assetIn;
  const lockAmount = order.orderType === "BUY" ? order.amount * order.price : order.amount;

  // Release locked balance back to shielded
  await prisma.vaultBalance.update({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol: lockAsset } },
    data: {
      lockedBalance: { decrement: lockAmount },
      shieldedBalance: { increment: lockAmount },
    },
  });

  // Mark order as cancelled
  await prisma.orderCommitment.update({
    where: { id: order.id },
    data: { status: "CANCELLED" },
  });

  // Show canonical pair
  const displayPair = order.orderType === "BUY"
    ? `${order.assetOut}/${order.assetIn}`
    : `${order.assetIn}/${order.assetOut}`;

  await prisma.activityEvent.create({
    data: {
      type: "ORDER_CREATED", // reuse type
      message: `Order cancelled: ${order.orderType} ${displayPair}`,
      metadata: JSON.stringify({
        orderId: order.id,
        walletAddress: params.walletAddress,
        pair: displayPair,
        action: "CANCELLED",
      }),
    },
  });

  wsManager.emit("order:cancelled", {
    orderId: order.id,
    shortId: shortOrderId(order.id),
    pair: displayPair,
    status: "CANCELLED",
  });

  wsManager.emit("activity:new", {
    type: "ORDER_CANCELLED",
    message: `Order cancelled: ${order.orderType} ${displayPair}`,
  });

  return {
    orderId: order.id,
    shortId: shortOrderId(order.id),
    status: "CANCELLED",
    releasedAmount: lockAmount,
    releasedAsset: lockAsset,
  };
}
