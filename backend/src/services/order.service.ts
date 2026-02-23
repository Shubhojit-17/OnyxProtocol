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
}) {
  const user = await prisma.user.findUnique({
    where: { walletAddress: params.walletAddress },
  });
  if (!user) throw new Error("User not found");

  const hash = params.commitmentHash || generateCommitmentHash();

  // For BUY orders: lock quote asset (e.g. ETH) equivalent from shielded balance
  // For SELL orders: lock base asset (e.g. STRK) from shielded balance
  const lockAsset = params.orderType === "BUY" ? params.assetOut : params.assetIn;
  const lockAmount = params.orderType === "BUY" ? params.amount * params.price : params.amount;

  // Check shielded balance — enforce sufficient funds
  const balanceAsset = params.orderType === "BUY" ? params.assetOut : params.assetIn;
  const balance = await prisma.vaultBalance.findUnique({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol: balanceAsset } },
  });

  const available = balance ? Number(balance.shieldedBalance) : 0;
  if (available < lockAmount) {
    throw new Error(
      `Insufficient shielded balance: you have ${available.toFixed(6)} ${balanceAsset} but need ${lockAmount.toFixed(6)} ${balanceAsset}. Deposit and shield funds in the Vault first.`
    );
  }

  await prisma.vaultBalance.update({
    where: { userId_assetSymbol: { userId: user.id, assetSymbol: balanceAsset } },
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
      expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
    },
  });

  await prisma.activityEvent.create({
    data: {
      type: "ORDER_CREATED",
      message: `New order committed: ${params.orderType} ${params.assetIn}/${params.assetOut}`,
      metadata: JSON.stringify({
        orderId: order.id,
        walletAddress: params.walletAddress,
        pair: `${params.assetIn}/${params.assetOut}`,
      }),
    },
  });

  wsManager.emit("order:created", {
    orderId: order.id,
    shortId: shortOrderId(order.id),
    orderType: params.orderType,
    pair: `${params.assetIn} / ${params.assetOut}`,
    commitmentHash: hash,
    status: "CREATED",
  });

  wsManager.emit("activity:new", {
    type: "ORDER_CREATED",
    message: `New order committed: ${params.orderType} ${params.assetIn}/${params.assetOut}`,
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
    pair: `${o.assetIn} / ${o.assetOut}`,
    orderType: o.orderType,
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

  // Aggregate by pair
  const pairMap = new Map<string, { buys: number; sells: number }>();
  for (const order of openOrders) {
    const pair = `${order.assetIn}/${order.assetOut}`;
    const entry = pairMap.get(pair) || { buys: 0, sells: 0 };
    if (order.orderType === "BUY") entry.buys++;
    else entry.sells++;
    pairMap.set(pair, entry);
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
