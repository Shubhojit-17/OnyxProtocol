import { useState, useEffect, useCallback } from "react";
import {
  Vault,
  Shield,
  Eye,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Lock,
  ArrowUpRight,
  Users,
  Activity,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "motion/react";
import { dashboardApi } from "../services/api";
import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";
import { useWallet } from "../hooks/useWallet";

const iconMap: Record<string, any> = {
  "Total Vault Balance": Vault,
  "Shielded Liquidity": Shield,
  "Active Hidden Orders": Eye,
  "Proof Verification Latency": Clock,
};

const colorMap: Record<string, string> = {
  "Total Vault Balance": "#2563eb",
  "Shielded Liquidity": "#4ade80",
  "Active Hidden Orders": "#f59e0b",
  "Proof Verification Latency": "#8b5cf6",
};

export default function DashboardOverviewPage() {
  const { walletAddress } = useWallet();
  const [period, setPeriod] = useState("24h");
  const [liveEventIndex, setLiveEventIndex] = useState(0);

  const { data, loading, refresh } = useApi(
    () => dashboardApi.getOverview(walletAddress ?? undefined, period),
    [walletAddress, period]
  );

  useWebSocket(
    useCallback(() => { refresh(); }, [refresh]),
    ["activity:new", "vault:updated", "proof:verified", "settlement:confirmed"]
  );

  useEffect(() => {
    if (!data?.activityFeed?.length) return;
    const interval = setInterval(() => {
      setLiveEventIndex((prev) => (prev + 1) % data.activityFeed.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [data?.activityFeed?.length]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-cobalt border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data && !loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#64748b]">
        Failed to load dashboard data. Please try refreshing.
      </div>
    );
  }

  const summaryCards = data.summaryCards.map((card: any) => ({
    ...card,
    icon: iconMap[card.title] || Activity,
    color: colorMap[card.title] || "#2563eb",
    positive: card.change?.startsWith("+") ?? true,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl text-white mb-1">Command Center</h1>
          <p className="text-sm text-[#64748b]">
            Overview of your private trading activity and protocol metrics.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-acid-green/5 border border-acid-green/10">
          <div className="w-2 h-2 rounded-full bg-acid-green animate-pulse" />
          <span className="text-xs text-acid-green">{data.systemStatus}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card: any, i: number) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="group p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${card.color}10`, border: `1px solid ${card.color}25` }}
              >
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <span
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                  card.positive ? "bg-acid-green/10 text-acid-green" : "bg-red-500/10 text-red-400"
                }`}
              >
                {card.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {card.change}
              </span>
            </div>
            <div className="text-xl text-white mb-0.5" style={{ fontFamily: "var(--font-mono)" }}>{card.value}</div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-[#475569]">{card.title}</div>
              {card.usd && <div className="text-xs text-[#475569]" style={{ fontFamily: "var(--font-mono)" }}>{card.usd}</div>}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-white mb-1">Liquidity Fog Index</h3>
              <p className="text-xs text-[#475569]">Anonymized liquidity density across the dark pool</p>
            </div>
            <div className="flex gap-2">
              {(["24h", "7d", "30d"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    period === p ? "bg-cobalt/10 text-cobalt border border-cobalt/20" : "text-[#475569] hover:text-white"
                  }`}
                >{p.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.fogData}>
                <defs>
                  <linearGradient id="fogGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="hour" stroke="rgba(255,255,255,0.1)" tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#f1f5f9", fontSize: "12px" }} />
                <Area type="monotone" dataKey="index" stroke="#2563eb" fill="url(#fogGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/[0.04]">
            {[
              { label: "Peak Index", value: data.fogMetrics?.peakIndex ?? "—", icon: Activity },
              { label: "Avg Liquidity", value: data.fogMetrics?.avgLiquidity ?? "—", icon: Zap },
              { label: "Pool Utilization", value: data.fogMetrics?.poolUtilization ?? "—", icon: TrendingUp },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-2">
                <m.icon className="w-3.5 h-3.5 text-[#475569]" />
                <div>
                  <div className="text-xs text-[#475569]">{m.label}</div>
                  <div className="text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>{m.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <h4 className="text-white mb-4">Privacy Health</h4>
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#4ade80" strokeWidth="8"
                    strokeDasharray={`${(data.privacyScore / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                    strokeLinecap="round" className="drop-shadow-[0_0_6px_rgba(74,222,128,0.5)]"
                    style={{ transition: "stroke-dasharray 1s ease-out" }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Shield className="w-5 h-5 text-acid-green mx-auto mb-1" />
                    <div className="text-2xl text-white" style={{ fontFamily: "var(--font-mono)" }}>{data.privacyScore}%</div>
                    <div className="text-[10px] text-[#475569]">Shield Score</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#94a3b8]"><Users className="w-3.5 h-3.5" /><span>Anonymity Set</span></div>
                <span className="text-white" style={{ fontFamily: "var(--font-mono)" }}>{data.anonymitySet} traders</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#94a3b8]"><Lock className="w-3.5 h-3.5" /><span>Shielded Ratio</span></div>
                <span className="text-white" style={{ fontFamily: "var(--font-mono)" }}>{data.shieldedRatio}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#94a3b8]"><Zap className="w-3.5 h-3.5" /><span>TVL Privacy Pool</span></div>
                <span className="text-white" style={{ fontFamily: "var(--font-mono)" }}>{data.tvl}</span>
              </div>
            </div>
            <p className="text-[10px] text-[#334155] mt-3">
              Higher TVL = Higher Privacy. Your anonymity set grows as more participants shield funds.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white">Global Privacy Events</h4>
              <div className="w-2 h-2 rounded-full bg-acid-green animate-pulse" />
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {(data.activityFeed || []).map((event: any, i: number) => (
                <motion.div
                  key={`${event.text}-${i}`}
                  initial={i === liveEventIndex ? { opacity: 0, x: -8 } : {}}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 py-2 border-b border-white/[0.03] last:border-0 ${
                    i === 0 ? "bg-white/[0.01] -mx-2 px-2 rounded-lg" : ""
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    event.type === "success" ? "bg-acid-green shadow-[0_0_6px_rgba(74,222,128,0.5)]"
                      : event.type === "pending" ? "bg-amber-accent animate-pulse" : "bg-cobalt"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{event.text}</div>
                    <div className="text-xs text-[#475569]">{event.time}</div>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-[#334155] shrink-0" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
