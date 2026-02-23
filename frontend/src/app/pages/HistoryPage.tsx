import { useState } from "react";
import {
  Download,
  Filter,
  ChevronDown,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Shield,
  Circle,
  Inbox,
} from "lucide-react";
import { motion } from "motion/react";
import { historyApi } from "../services/api";
import { useApi } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const { walletAddress } = useWallet();
  const [statusFilter, setStatusFilter] = useState("All");
  const [assetFilter, setAssetFilter] = useState("All");
  const [exportDropdown, setExportDropdown] = useState(false);
  const [page, setPage] = useState(1);

  const { data: historyData } = useApi(
    () => walletAddress ? historyApi.getTrades(walletAddress) : Promise.resolve({ trades: [], summary: { settled: 0, pending: 0, failed: 0 } }),
    [walletAddress]
  );

  const trades = historyData?.trades || [];
  const summary = historyData?.summary || { settled: 0, pending: 0, failed: 0, open: 0 };

  const filtered = trades.filter((t: any) => {
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    if (assetFilter !== "All" && !t.pair.includes(assetFilter)) return false;
    return true;
  });

  const handleExport = async (format: string) => {
    if (format === "__nav_compliance__") {
      setExportDropdown(false);
      window.location.href = "/app/compliance";
      return;
    }
    if (!walletAddress) return;
    setExportDropdown(false);
    try {
      const data = await historyApi.exportTrades(walletAddress, format);
      const blob = new Blob([data], { type: format === "csv" ? "text/csv" : "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `onyx-trades.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white mb-1">History & Reports</h1>
          <p className="text-sm text-[#64748b]">Privacy-preserved trade records with compliance export</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setExportDropdown(!exportDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-cobalt text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] text-sm"
          >
            <Download className="w-4 h-4" />
            Compliance Export
          </button>
          {exportDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-12 w-56 p-2 rounded-xl bg-[#1e293b] border border-white/[0.1] shadow-2xl z-10"
            >
              {[
                { icon: FileText, label: "Export as JSON", desc: "Compliance-grade report", format: "json" },
                { icon: Download, label: "Export as CSV", desc: "Raw data export", format: "csv" },
                { icon: Shield, label: "View Compliance", desc: "For auditors/regulators", format: "__nav_compliance__" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleExport(opt.format)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                >
                  <opt.icon className="w-4 h-4 text-cobalt" />
                  <div>
                    <div className="text-sm text-white">{opt.label}</div>
                    <div className="text-[10px] text-[#475569]">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="text-xs text-[#475569] mb-1">Open</div>
          <div className="text-lg text-cobalt" style={{ fontFamily: "var(--font-mono)" }}>{summary.open}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="text-xs text-[#475569] mb-1">Settled</div>
          <div className="text-lg text-acid-green" style={{ fontFamily: "var(--font-mono)" }}>{summary.settled}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="text-xs text-[#475569] mb-1">Pending</div>
          <div className="text-lg text-amber-accent" style={{ fontFamily: "var(--font-mono)" }}>{summary.pending}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="text-xs text-[#475569] mb-1">Failed</div>
          <div className="text-lg text-red-400" style={{ fontFamily: "var(--font-mono)" }}>{summary.failed}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <Filter className="w-4 h-4 text-[#475569]" />
          <span className="text-xs text-[#475569]">Filters:</span>
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white appearance-none pr-8 focus:outline-none focus:border-cobalt/40"
          >
            <option value="All">All Status</option>
            <option value="Open">Open</option>
            <option value="Settled">Settled</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569] pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white appearance-none pr-8 focus:outline-none focus:border-cobalt/40"
          >
            <option value="All">All Assets</option>
            <option value="STRK">STRK</option>
            <option value="ETH">ETH</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569] pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <Clock className="w-3.5 h-3.5 text-[#475569]" />
          <span className="text-xs text-[#94a3b8]">{
            trades.length > 0
              ? (() => {
                  const dates = trades.map((t: any) => new Date(t.date || t.createdAt));
                  const min = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
                  const max = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
                  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  return `${fmt(min)} - ${fmt(max)}`;
                })()
              : "No trades"
          }</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Trade ID", "Type", "Asset Pair", "Status", "Proof", "Time", "Amount", "Commitment", "Date"].map(
                  (header) => (
                    <th key={header} className="text-left text-xs text-[#475569] px-4 py-3 whitespace-nowrap">
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Inbox className="w-10 h-10 text-[#334155]" />
                      <div>
                        <p className="text-sm text-[#64748b]">No trades yet</p>
                        <p className="text-xs text-[#475569] mt-1">Create an order on the Trade page to get started</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((trade: any, i: number) => (
                <motion.tr
                  key={trade.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm text-cobalt" style={{ fontFamily: "var(--font-mono)" }}>
                      {trade.id}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${trade.orderType === "BUY" ? "text-acid-green" : "text-red-400"}`}>
                      {trade.orderType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-white whitespace-nowrap">{trade.pair}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                        trade.status === "Settled"
                          ? "bg-acid-green/10 text-acid-green"
                          : trade.status === "Open"
                          ? "bg-cobalt/10 text-cobalt"
                          : trade.status === "Pending"
                          ? "bg-amber-accent/10 text-amber-accent"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {trade.status === "Settled" ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : trade.status === "Open" ? (
                        <Circle className="w-3 h-3" />
                      ) : trade.status === "Pending" ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {trade.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {trade.proofVerified ? (
                      <span className="flex items-center gap-1 text-xs text-acid-green">
                        <div className="w-2 h-2 rounded-full bg-acid-green shadow-[0_0_4px_rgba(74,222,128,0.5)]" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-xs text-[#475569]">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>
                    {trade.settlementTime}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#94a3b8]" style={{ fontFamily: "var(--font-mono)" }}>
                      {trade.amount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs text-[#64748b] truncate max-w-[120px] inline-block"
                      style={{ fontFamily: "var(--font-mono)" }}
                      title={trade.commitmentHash || ""}
                    >
                      {trade.commitmentHash || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#475569] whitespace-nowrap">{trade.date}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
          <span className="text-xs text-[#475569]">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} trades
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-xs text-[#475569] border border-white/[0.06] rounded-lg hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: Math.ceil(filtered.length / PAGE_SIZE) }, (_, i) => i + 1).slice(0, 5).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                  p === page
                    ? "text-cobalt bg-cobalt/10 border-cobalt/20"
                    : "text-[#475569] border-white/[0.06] hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / PAGE_SIZE), p + 1))}
              disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
              className="px-3 py-1 text-xs text-[#475569] border border-white/[0.06] rounded-lg hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
