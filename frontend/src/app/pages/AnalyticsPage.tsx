import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { ChevronDown, TrendingUp, Activity, Users, Shield, Zap } from "lucide-react";
import { motion } from "motion/react";
import { analyticsApi } from "../services/api";
import { useApi } from "../hooks/useApi";

const kpiIconMap: Record<string, any> = {
  "Total Volume": TrendingUp,
  "Avg Proof Speed": Activity,
  "Anonymity Set": Users,
  "Shielded Ratio": Shield,
  "Proof Velocity": Zap,
};

const kpiColorMap: Record<string, string> = {
  "Total Volume": "#2563eb",
  "Avg Proof Speed": "#4ade80",
  "Anonymity Set": "#8b5cf6",
  "Shielded Ratio": "#f59e0b",
  "Proof Velocity": "#06b6d4",
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const [asset, setAsset] = useState("All Assets");

  // Fetch all analytics data from API
  const { data: volumeData } = useApi(() => analyticsApi.getVolume(period), [period]);
  const { data: proofSpeedData } = useApi(() => analyticsApi.getProofVelocity(), []);
  const { data: anonymityData } = useApi(() => analyticsApi.getAnonymitySet(period), [period]);
  const { data: liquidityGrowth } = useApi(() => analyticsApi.getLiquidityGrowth(period), [period]);
  const { data: densityData } = useApi(() => analyticsApi.getDensity(), []);
  const { data: kpisData } = useApi(() => analyticsApi.getKpis(), []);

  const kpis = (kpisData || []).map((kpi: any) => ({
    ...kpi,
    icon: kpiIconMap[kpi.label] || TrendingUp,
    color: kpiColorMap[kpi.label] || "#2563eb",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white mb-1">Analytics</h1>
          <p className="text-sm text-[#64748b]">Protocol metrics, performance data, and privacy statistics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            {["24h", "7d", "30d"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  period === p ? "bg-cobalt/10 text-cobalt" : "text-[#475569] hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="relative">
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-1.5 text-xs text-white appearance-none pr-8 focus:outline-none focus:border-cobalt/40"
            >
              <option value="All Assets">All Assets</option>
              <option value="STRK">STRK</option>
              <option value="ETH">ETH</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              <span className="text-xs text-[#475569]">{kpi.label}</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-xl text-white" style={{ fontFamily: "var(--font-mono)" }}>
                {kpi.value}
              </span>
              <span className="text-xs text-acid-green mb-0.5">{kpi.change}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stochastic Density Plot - Featured */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white">Stochastic Liquidity Density</h3>
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-acid-green/5 border border-acid-green/10">
            <div className="w-1.5 h-1.5 rounded-full bg-acid-green animate-pulse" />
            <span className="text-[10px] text-acid-green">Live</span>
          </div>
        </div>
        <p className="text-xs text-[#475569] mb-4">
          Probability density of trade execution across price levels. Replaces traditional candlestick view.
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={densityData || []}>
              <defs>
                <linearGradient id="densityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#2563eb" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="price"
                stroke="rgba(255,255,255,0.1)"
                tick={{ fill: "#475569", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
              />
              <YAxis
                stroke="rgba(255,255,255,0.1)"
                tick={{ fill: "#475569", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                label={{ value: "Density", angle: -90, position: "insideLeft", fill: "#475569", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#f1f5f9",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [
                  name === "density" ? `${value.toFixed(1)}%` : `${value} trades`,
                  name === "density" ? "Probability" : "Est. Volume",
                ]}
                labelFormatter={(v: number) => `Price: $${v.toLocaleString()}`}
              />
              <Area type="monotone" dataKey="density" stroke="#2563eb" fill="url(#densityGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Volume */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <h3 className="text-white mb-1">Volume Over Time</h3>
          <p className="text-xs text-[#475569] mb-4">Daily trading volume (total vs shielded)</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${(value / 1000000).toFixed(2)}M`]}
                />
                <Bar dataKey="volume" fill="rgba(37, 99, 235, 0.3)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="shielded" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2 text-xs text-[#475569]">
              <div className="w-3 h-3 rounded-sm bg-[rgba(37,99,235,0.3)]" /> Total
            </div>
            <div className="flex items-center gap-2 text-xs text-[#475569]">
              <div className="w-3 h-3 rounded-sm bg-cobalt" /> Shielded
            </div>
          </div>
        </div>

        {/* Proof Speed */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-white">Proof Verification Speed</h3>
            {/* Sparkline preview */}
            <svg width="50" height="16" className="text-acid-green">
              <polyline
                points={(proofSpeedData || [])
                  .slice(-10)
                  .map((d: any, i: number) => `${i * 5},${8 - (d.speed - 1) * 4}`)
                  .join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <p className="text-xs text-[#475569] mb-4">Average ZK proof verification time (seconds)</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={proofSpeedData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="hour"
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 3]}
                  tickFormatter={(v: number) => `${v}s`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value}s`, "Speed"]}
                />
                <Line type="monotone" dataKey="speed" stroke="#4ade80" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Anonymity Set Growth - Stacked */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <h3 className="text-white mb-1">Anonymity Set Growth</h3>
          <p className="text-xs text-[#475569] mb-4">Shielded asset growth by token type (stacked)</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={anonymityData || []}>
                <defs>
                  <linearGradient id="strkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ethGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="strk" stackId="1" stroke="#2563eb" fill="url(#strkGrad)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="eth" stackId="1" stroke="#8b5cf6" fill="url(#ethGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2 text-xs text-[#475569]">
              <div className="w-3 h-3 rounded-sm bg-cobalt" /> STRK
            </div>
            <div className="flex items-center gap-2 text-xs text-[#475569]">
              <div className="w-3 h-3 rounded-sm bg-[#8b5cf6]" /> ETH
            </div>
          </div>
        </div>

        {/* Shielded Liquidity Growth */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <h3 className="text-white mb-1">Total Value Locked (Shielded)</h3>
          <p className="text-xs text-[#475569] mb-4">Total value locked in shielded vaults</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liquidityGrowth || []}>
                <defs>
                  <linearGradient id="liqGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${(value / 1000000).toFixed(2)}M`, "TVL"]}
                />
                <Area type="monotone" dataKey="liquidity" stroke="#2563eb" fill="url(#liqGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
