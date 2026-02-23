import { useState, useMemo, useEffect, useCallback } from "react";
import { Eye, CloudFog, Activity, Info, ChevronDown, Layers, Zap } from "lucide-react";
import { motion } from "motion/react";
import { darkPoolApi } from "../services/api";
import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";

export default function DarkPoolPage() {
  const [assetPair, setAssetPair] = useState("STRK / ETH");
  const [timeRange, setTimeRange] = useState("24H");
  const [intensity, setIntensity] = useState(70);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const { data: poolStats, refresh } = useApi(() => darkPoolApi.getStats(), []);

  useWebSocket(
    useCallback(() => { refresh(); }, [refresh]),
    ["order:created", "order:matched", "pool:updated"]
  );

  const hiddenOrderCount = poolStats?.hiddenOrderCount ?? 0;

  // Generate heatmap data with Gaussian-like distribution
  const heatmapData: number[][] = useMemo(
    () => {
      if (poolStats?.heatmapData) {
        return poolStats.heatmapData.map((row: number[]) =>
          row.map((v: number) => v * (intensity / 100))
        );
      }
      return Array.from({ length: 20 }, () =>
        Array.from({ length: 30 }, () => 0)
      );
    },
    [intensity, poolStats]
  );

  const liquidityZones = useMemo(() => {
    let zones = 0;
    for (let r = 0; r < heatmapData.length; r++) {
      for (let c = 0; c < heatmapData[0].length; c++) {
        if (heatmapData[r][c] > 0.5 * (intensity / 100)) zones++;
      }
    }
    return poolStats?.liquidityZones ?? Math.ceil(zones / 12);
  }, [heatmapData, intensity, poolStats]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-white mb-1">Dark Pool</h1>
        <p className="text-sm text-[#64748b]">
          Anonymized liquidity visualization &mdash; Liquidity Fog
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-cobalt" />
            <span className="text-xs text-[#475569]">Active Hidden Orders</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="text-xl text-white tabular-nums"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {hiddenOrderCount}
            </div>
            <div className="w-2 h-2 rounded-full bg-acid-green animate-pulse" />
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <CloudFog className="w-4 h-4 text-cobalt" />
            <span className="text-xs text-[#475569]">Liquidity Zones Detected</span>
          </div>
          <div className="text-xl text-white" style={{ fontFamily: "var(--font-mono)" }}>
            {liquidityZones}
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-cobalt" />
            <span className="text-xs text-[#475569]">Consensus Mid Price</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xl text-white" style={{ fontFamily: "var(--font-mono)" }}>
              {poolStats?.midPrice || "—"}
            </div>
            <span className="text-xs text-acid-green">{poolStats?.oracle || "Pragma Oracle"}</span>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-cobalt" />
            <span className="text-xs text-[#475569]">Proof Velocity</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xl text-white" style={{ fontFamily: "var(--font-mono)" }}>
              {poolStats?.proofVelocity || "—"}
            </div>
            {/* Sparkline */}
            {poolStats?.proofVelocity && (
            <svg width="60" height="20" className="text-acid-green">
              <polyline
                points={Array.from({ length: 12 }, (_, i) => `${i * 5},${10 + Math.sin(i * 0.8) * 6}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Left Filters */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-5">
            <h4 className="text-white text-sm">Filters</h4>

            {/* Asset Pair */}
            <div>
              <label className="text-xs text-[#475569] mb-2 block">Asset Pair</label>
              <div className="relative">
                <select
                  value={assetPair}
                  onChange={(e) => setAssetPair(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-cobalt/40"
                >
                  <option value="STRK / ETH">STRK / ETH</option>
                  <option value="ETH / STRK">ETH / STRK</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569] pointer-events-none" />
              </div>
            </div>

            {/* Time Range */}
            <div>
              <label className="text-xs text-[#475569] mb-2 block">Time Range</label>
              <div className="grid grid-cols-3 gap-2">
                {["1H", "24H", "7D"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    className={`py-2 rounded-lg text-xs transition-all ${
                      timeRange === t
                        ? "bg-cobalt/10 text-cobalt border border-cobalt/20"
                        : "bg-white/[0.02] text-[#64748b] border border-white/[0.06]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity Slider */}
            <div>
              <label className="text-xs text-[#475569] mb-2 block">
                Fog Density: {intensity}%
              </label>
              <input
                type="range"
                min={10}
                max={100}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-cobalt"
              />
            </div>
          </div>

          {/* Legend */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <h4 className="text-white text-sm mb-3">Density Legend</h4>
            <div className="flex items-center gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-4 rounded-sm"
                  style={{
                    backgroundColor: `rgba(37, 99, 235, ${0.03 + i * 0.12})`,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-[#475569]">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Live Events */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white text-sm">Live Pool Events</h4>
              <div className="w-2 h-2 rounded-full bg-acid-green animate-pulse" />
            </div>
            <div className="space-y-2">
              {(poolStats?.events || []).map((event: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-acid-green" : "bg-cobalt/50"}`} />
                  <span className="text-[#94a3b8] flex-1">{event.text}</span>
                  <span className="text-[#475569]" style={{ fontFamily: "var(--font-mono)" }}>
                    {event.time}
                  </span>
                </div>
              ))}
              {(!poolStats?.events || poolStats.events.length === 0) && (
                <p className="text-xs text-[#475569]">No recent events</p>
              )}
            </div>
          </div>
        </div>

        {/* Main Heatmap */}
        <div className="lg:col-span-3 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-white mb-1">Liquidity Fog Heatmap</h3>
              <p className="text-xs text-[#475569]">
                {assetPair} &middot; {timeRange} &middot; Live
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-acid-green animate-pulse" />
                <span className="text-xs text-[#475569]">Streaming</span>
              </div>
              <div className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <span className="text-[10px] text-[#475569]" style={{ fontFamily: "var(--font-mono)" }}>
                  {hiddenOrderCount} orders
                </span>
              </div>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="relative">
            {/* Y-axis labels */}
            <div className="absolute -left-1 top-0 bottom-8 flex flex-col justify-between py-1">
              {(poolStats?.priceLevels || ["—", "—", "—", "—", "—"]).map((label: string, idx: number) => (
                <span
                  key={idx}
                  className="text-[10px] text-[#334155]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="ml-12">
              {/* Consensus mid-price line */}
              <div className="absolute left-12 right-0 top-[45%] z-10 pointer-events-none">
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-dashed border-amber-accent/30" />
                  <span className="text-[9px] text-amber-accent px-1.5 py-0.5 rounded bg-amber-accent/10 border border-amber-accent/20" style={{ fontFamily: "var(--font-mono)" }}>
                    MID {poolStats?.midPrice || "—"}
                  </span>
                </div>
              </div>

              <div
                className="grid gap-[2px]"
                style={{ gridTemplateRows: `repeat(${heatmapData.length}, 1fr)` }}
              >
                {heatmapData.map((row, rowI) => (
                  <div
                    key={rowI}
                    className="grid gap-[2px]"
                    style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}
                  >
                    {row.map((cell, colI) => {
                      const isHovered = hoveredCell?.row === rowI && hoveredCell?.col === colI;
                      return (
                        <div
                          key={colI}
                          className="aspect-[2/1] rounded-sm transition-all duration-300 cursor-crosshair"
                          onMouseEnter={() => setHoveredCell({ row: rowI, col: colI })}
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{
                            backgroundColor:
                              cell > 0.6
                                ? `rgba(37, 99, 235, ${0.4 + cell * 0.5})`
                                : cell > 0.3
                                ? `rgba(37, 99, 235, ${0.15 + cell * 0.3})`
                                : `rgba(255, 255, 255, ${0.02 + cell * 0.08})`,
                            boxShadow: isHovered
                              ? `0 0 12px rgba(37, 99, 235, ${cell * 0.8})`
                              : cell > 0.7
                              ? `0 0 4px rgba(37, 99, 235, ${cell * 0.3})`
                              : "none",
                            transform: isHovered ? "scale(1.8)" : "scale(1)",
                            zIndex: isHovered ? 10 : 1,
                            position: "relative",
                          }}
                          title={`Density: ${(cell * 100).toFixed(0)}%`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between mt-2">
                {["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"].map((label) => (
                  <span
                    key={label}
                    className="text-[10px] text-[#334155]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Hover info */}
          {hoveredCell && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 inline-flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]"
            >
              <span className="text-xs text-[#475569]">Cell Density:</span>
              <span className="text-xs text-cobalt" style={{ fontFamily: "var(--font-mono)" }}>
                {(heatmapData[hoveredCell.row][hoveredCell.col] * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-[#475569]">|</span>
              <span className="text-xs text-[#475569]">Estimated Volume:</span>
              <span className="text-xs text-white" style={{ fontFamily: "var(--font-mono)" }}>
                {(heatmapData[hoveredCell.row][hoveredCell.col] * 2450).toFixed(0)} STRK
              </span>
            </motion.div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 mt-6 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <Info className="w-4 h-4 text-[#475569] shrink-0 mt-0.5" />
            <p className="text-xs text-[#475569] leading-relaxed">
              Liquidity visualization is anonymized and privacy-preserving. Individual order
              size, price, and direction are never revealed. Heatmap density represents
              aggregated order flow within cryptographic bounds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
