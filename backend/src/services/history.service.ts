import prisma from "../db/prisma.js";
import { shortOrderId } from "../utils/helpers.js";

export async function getTradeHistory(walletAddress: string) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) return [];

  const orders = await prisma.orderCommitment.findMany({
    where: {
      userId: user.id,
    },
    include: {
      buyMatch: { include: { proof: true, settlement: true } },
      sellMatch: { include: { proof: true, settlement: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o: any) => {
    const match = o.buyMatch || o.sellMatch;
    const proof = match?.proof;
    const settlement = match?.settlement;

    const statusMap: Record<string, string> = {
      CREATED: "Open",
      MATCHED: "Pending",
      PROVING: "Pending",
      VERIFIED: "Pending",
      SETTLED: "Settled",
      CANCELLED: "Failed",
    };

    return {
      id: shortOrderId(o.id),
      orderId: o.id,
      matchId: match?.id ?? null,
      pair: o.orderType === "BUY" ? `${o.assetOut} / ${o.assetIn}` : `${o.assetIn} / ${o.assetOut}`,
      orderType: o.orderType,
      status: statusMap[o.status] || o.status,
      rawStatus: o.status,
      proofVerified: proof?.proofStatus === "VERIFIED",
      settlementTime: settlement
        ? `${((settlement.settledAt.getTime() - o.createdAt.getTime()) / 1000).toFixed(1)}s`
        : "—",
      amount: o.status === "SETTLED" ? "████████" : `${o.amount} ${o.assetIn}`,
      counterparty: match ? "REDACTED" : "—",
      date: o.createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      proofId: proof?.proofId
        ? `${proof.proofId.slice(0, 6)}...${proof.proofId.slice(-4)}`
        : "—",
      commitmentHash: o.commitmentHash
        ? `${o.commitmentHash.slice(0, 10)}...${o.commitmentHash.slice(-4)}`
        : null,
    };
  });
}

export async function getTradeHistorySummary(walletAddress: string) {
  const trades = await getTradeHistory(walletAddress);

  return {
    trades,
    summary: {
      total: trades.length,
      settled: trades.filter((t: any) => t.status === "Settled").length,
      pending: trades.filter((t: any) => t.status === "Pending").length,
      failed: trades.filter((t: any) => t.status === "Failed").length,
      open: trades.filter((t: any) => t.status === "Open").length,
    },
  };
}

export async function exportTradeHistory(
  walletAddress: string,
  format: string
) {
  const trades = await getTradeHistory(walletAddress);

  if (format === "csv") {
    const header = "ID,Pair,Type,Status,Proof Verified,Settlement Time,Date\n";
    const rows = trades
      .map(
        (t: any) =>
          `${t.id},${t.pair},${t.orderType},${t.status},${t.proofVerified},${t.settlementTime},${t.date}`
      )
      .join("\n");
    return { content: header + rows, contentType: "text/csv", filename: "onyx_trade_history.csv" };
  }

  // For PDF, return a placeholder
  return {
    content: JSON.stringify(trades, null, 2),
    contentType: "application/json",
    filename: "onyx_trade_history.json",
  };
}
