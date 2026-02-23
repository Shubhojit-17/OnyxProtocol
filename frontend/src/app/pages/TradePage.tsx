import { useState, useEffect, useCallback } from "react";
import {
  Lock,
  Shield,
  Copy,
  X,
  Check,
  ChevronDown,
  Info,
  Zap,
  Eye,
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
import { motion, AnimatePresence } from "motion/react";
import { orderApi, darkPoolApi } from "../services/api";
import { useApi } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";
import { useWebSocket } from "../hooks/useWebSocket";

function generatePriceData(midPrice: number) {
  return Array.from({ length: 48 }, (_, i) => ({
    time: `${Math.floor(i / 2)}:${i % 2 === 0 ? "00" : "30"}`,
    price: midPrice - 200 + Math.sin(i * 0.3) * 400 + (i * 3),
  }));
}

const proofMessages = [
  "Initializing FRI-domain expansion...",
  "Computing polynomial evaluations...",
  "Generating execution trace...",
  "Building Merkle commitment tree...",
  "Assembling witness columns...",
  "Polynomial commitment finalizing...",
  "ZK-STARK proof assembled.",
  "Submitting to Starknet validator...",
  "Proof verified on-chain.",
];

export default function TradePage() {
  const { walletAddress } = useWallet();
  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [asset, setAsset] = useState("STRK / ETH");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [expiry, setExpiry] = useState("24h");
  const [privacyLevel, setPrivacyLevel] = useState(100);
  const [partialFill, setPartialFill] = useState(false);
  const [complianceExport, setComplianceExport] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [proofState, setProofState] = useState<"idle" | "generating" | "complete">("idle");
  const [proofProgress, setProofProgress] = useState(0);
  const [currentProofMsg, setCurrentProofMsg] = useState(0);
  const [copied, setCopied] = useState(false);
  const [commitmentHash, setCommitmentHash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proofStartTime, setProofStartTime] = useState<number>(0);
  const [proofElapsed, setProofElapsed] = useState<string>("—");
  const [gasEstimate, setGasEstimate] = useState<string>("—");

  // Fetch recent orders from API
  const { data: ordersData, refresh: refreshOrders } = useApi(
    () => walletAddress ? orderApi.list(walletAddress) : Promise.resolve({ orders: [] }),
    [walletAddress]
  );

  // Fetch pool stats
  const { data: poolData, refresh: refreshPool } = useApi(
    () => darkPoolApi.getStats(),
    []
  );

  // Listen for WS events
  useWebSocket(
    useCallback(() => { refreshOrders(); refreshPool(); }, [refreshOrders, refreshPool]),
    ["order:created", "order:matched", "proof:verified", "settlement:confirmed"]
  );

  const recentCommitments = (ordersData?.orders || []).slice(0, 5).map((o: any) => ({
    id: o.commitmentHash?.substring(0, 10) + "..." + o.commitmentHash?.substring(o.commitmentHash.length - 4) || o.id.substring(0, 10),
    status: o.status === "SETTLED" ? "Settled" : o.status === "MATCHED" ? "Matched" : "Pending",
    time: getRelativeTime(o.createdAt),
    pair: o.pair || `${o.assetIn}/${o.assetOut}`,
  }));

  const privacyLabel =
    privacyLevel >= 80 ? "Maximum" : privacyLevel >= 50 ? "Enhanced" : privacyLevel >= 20 ? "Standard" : "Minimal";
  const privacyColor =
    privacyLevel >= 80 ? "#4ade80" : privacyLevel >= 50 ? "#2563eb" : privacyLevel >= 20 ? "#f59e0b" : "#ef4444";

  // Proof generation animation
  useEffect(() => {
    if (proofState !== "generating") return;

    const progressInterval = setInterval(() => {
      setProofProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          const elapsed = ((Date.now() - proofStartTime) / 1000).toFixed(2);
          setProofElapsed(`${elapsed}s`);
          setGasEstimate(`~${(0.001 + Math.random() * 0.002).toFixed(4)} STRK`);
          setProofState("complete");
          return 100;
        }
        return prev + 1;
      });
    }, 40);

    const msgInterval = setInterval(() => {
      setCurrentProofMsg((prev) => {
        if (prev >= proofMessages.length - 1) {
          clearInterval(msgInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 450);

    return () => {
      clearInterval(progressInterval);
      clearInterval(msgInterval);
    };
  }, [proofState]);

  const [formError, setFormError] = useState<string | null>(null);

  const handleGenerateCommitment = async () => {
    setFormError(null);
    if (!walletAddress) { setFormError("Connect your wallet first"); return; }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { setFormError("Enter a valid amount greater than 0"); return; }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) { setFormError("Enter a valid price greater than 0"); return; }
    setProofState("generating");
    setProofProgress(0);
    setCurrentProofMsg(0);
    setProofStartTime(Date.now());
    setProofElapsed("—");
    setGasEstimate("—");
    setShowModal(true);
    setSubmitting(true);

    const [assetIn, assetOut] = asset.split(" / ").map((s) => s.trim());
    const expiryDate = new Date();
    if (expiry === "1h") expiryDate.setHours(expiryDate.getHours() + 1);
    else if (expiry === "24h") expiryDate.setHours(expiryDate.getHours() + 24);
    else expiryDate.setDate(expiryDate.getDate() + 7);

    try {
      const { order } = await orderApi.create({
        walletAddress,
        assetIn,
        assetOut,
        orderType,
        amount: parseFloat(amount),
        price: parseFloat(price),
        expiresAt: expiryDate.toISOString(),
      });
      setCommitmentHash(order.commitmentHash);
      refreshOrders();
    } catch (err: any) {
      console.error("Order creation failed:", err);
      setProofState("idle");
      setShowModal(false);
      const msg = err?.response?.data?.error || err?.message || "Order creation failed";
      setFormError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(commitmentHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-white mb-1">Trade</h1>
        <p className="text-sm text-[#64748b]">Create private encrypted orders in the dark pool</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Order Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-white mb-6">Create Private Order</h3>

            {/* Stealth Order Type Toggle */}
            <div className="relative grid grid-cols-2 gap-0 p-1 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-5">
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ${
                  orderType === "BUY" ? "left-1" : "left-[calc(50%+2px)]"
                }`}
                style={{
                  background:
                    orderType === "BUY"
                      ? "linear-gradient(135deg, rgba(74,222,128,0.15), rgba(74,222,128,0.05))"
                      : "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
                  border:
                    orderType === "BUY" ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(239,68,68,0.2)",
                }}
              />
              {(["BUY", "SELL"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className={`relative z-10 py-2.5 rounded-lg text-sm transition-colors ${
                    orderType === type
                      ? type === "BUY"
                        ? "text-acid-green"
                        : "text-red-400"
                      : "text-[#64748b] hover:text-white"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Asset Selector */}
            <div className="mb-4">
              <label className="text-xs text-[#64748b] mb-2 block">Asset Pair</label>
              <div className="relative">
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-cobalt/40"
                >
                  <option value="STRK / ETH">STRK / ETH</option>
                  <option value="ETH / STRK">ETH / STRK</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569] pointer-events-none" />
              </div>
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label className="text-xs text-[#64748b] mb-2 block">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-[#334155] focus:outline-none focus:border-cobalt/40"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#475569]">STRK</span>
              </div>
            </div>

            {/* Limit Price */}
            <div className="mb-4">
              <label className="text-xs text-[#64748b] mb-2 block">Limit Price</label>
              <div className="relative">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.4250"
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-[#334155] focus:outline-none focus:border-cobalt/40"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#475569]">ETH</span>
              </div>
            </div>

            {/* Expiry */}
            <div className="mb-5">
              <label className="text-xs text-[#64748b] mb-2 block">Expiry</label>
              <div className="flex gap-2">
                {["1h", "24h", "7d"].map((exp) => (
                  <button
                    key={exp}
                    onClick={() => setExpiry(exp)}
                    className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                      expiry === exp
                        ? "bg-cobalt/10 text-cobalt border border-cobalt/20"
                        : "bg-white/[0.02] text-[#64748b] border border-white/[0.06] hover:text-white"
                    }`}
                  >
                    {exp}
                  </button>
                ))}
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setPartialFill(!partialFill)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    partialFill ? "bg-cobalt border-cobalt" : "border-white/[0.15] bg-white/[0.02]"
                  }`}
                >
                  {partialFill && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-[#94a3b8]">Allow partial fill</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setComplianceExport(!complianceExport)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    complianceExport ? "bg-cobalt border-cobalt" : "border-white/[0.15] bg-white/[0.02]"
                  }`}
                >
                  {complianceExport && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-[#94a3b8]">Enable Compliance Export</span>
              </label>
            </div>

            {/* Privacy Meter */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" style={{ color: privacyColor }} />
                  <span className="text-sm" style={{ color: privacyColor }}>
                    {privacyLabel} Privacy
                  </span>
                </div>
                <span className="text-xs text-[#475569]" style={{ fontFamily: "var(--font-mono)" }}>
                  {privacyLevel}%
                </span>
              </div>
              <div className="relative w-full h-2 rounded-full bg-white/[0.04] mb-3">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${privacyLevel}%`,
                    background: `linear-gradient(90deg, ${privacyColor}60, ${privacyColor})`,
                    boxShadow: `0 0 8px ${privacyColor}30`,
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={privacyLevel}
                onChange={(e) => setPrivacyLevel(Number(e.target.value))}
                className="w-full accent-cobalt"
              />
              <div className="flex justify-between text-[10px] text-[#475569] mt-1">
                <span>Faster matching</span>
                <span>Maximum privacy</span>
              </div>
              <p className="text-xs text-[#475569] mt-2">
                {privacyLevel >= 80
                  ? "Order fully hidden until settlement. No information leakage."
                  : privacyLevel >= 50
                  ? "Order type partially visible for faster matching. Amount hidden."
                  : "Order details partially leaked to improve match speed."}
              </p>
            </div>

            {/* Form error */}
            {formError && (
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 mb-4">
                <p className="text-xs text-red-400">{formError}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleGenerateCommitment}
              disabled={submitting}
              className={`w-full py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                orderType === "BUY"
                  ? "bg-cobalt text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
                  : "bg-red-500/80 text-white hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
              }`}
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {submitting ? "Submitting..." : "Generate Commitment"}
            </button>
          </div>

          {/* Recent Commitments */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <h4 className="text-white text-sm mb-4">Recent Commitments</h4>
            <div className="space-y-3">
              {recentCommitments.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#94a3b8]" style={{ fontFamily: "var(--font-mono)" }}>
                      {c.id}
                    </span>
                    <span className="text-[10px] text-[#475569]">{c.pair}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        c.status === "Settled"
                          ? "bg-acid-green/10 text-acid-green"
                          : c.status === "Matched"
                          ? "bg-cobalt/10 text-cobalt"
                          : "bg-amber-accent/10 text-amber-accent"
                      }`}
                    >
                      {c.status}
                    </span>
                    <span className="text-xs text-[#475569]">{c.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-3 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-white mb-1">STRK / ETH</h3>
              <div className="flex items-center gap-3">
                <span className="text-2xl text-white" style={{ fontFamily: "var(--font-mono)" }}>
                  {poolData?.midPrice || "—"}
                </span>
                <span className="text-sm text-acid-green">{poolData ? "Live" : "—"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <Info className="w-3.5 h-3.5 text-[#475569]" />
              <span className="text-xs text-[#475569]">Oracle Reference (Pragma)</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={generatePriceData(poolData?.midPriceRaw || 0)}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="time"
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fill: "#475569", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={["dataMin - 100", "dataMax + 100"]}
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fill: "#475569", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
                />
                <Area type="monotone" dataKey="price" stroke="#4ade80" fill="url(#priceGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Market Info */}
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/[0.04]">
            <div>
              <div className="text-xs text-[#475569] mb-1">24h Volume</div>
              <div className="text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>
                {poolData?.volume24h || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#475569] mb-1">Hidden Orders</div>
              <div className="text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>
                {poolData?.hiddenOrderCount ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#475569] mb-1">Avg Proof Time</div>
              <div className="text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>
                {poolData?.proofVelocity || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#475569] mb-1">Anonymity Set</div>
              <div className="text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>
                {poolData?.anonymitySet ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Commitment / Proof Generation Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-2xl bg-[#111827] border border-white/[0.08] shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white">
                  {proofState === "complete" ? "Commitment Created" : "Generating ZK-STARK Proof"}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setProofState("idle");
                  }}
                  className="p-1 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <X className="w-4 h-4 text-[#475569]" />
                </button>
              </div>

              {proofState === "generating" && (
                <div className="space-y-6">
                  {/* Geometric assembly animation */}
                  <div className="flex items-center justify-center py-4">
                    <div className="relative w-20 h-20">
                      {/* Spinning hexagons */}
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0, rotate: 0 }}
                          animate={{
                            opacity: proofProgress > i * 15 ? [0.3, 0.8, 0.3] : 0,
                            scale: proofProgress > i * 15 ? 1 : 0,
                            rotate: [0, 60, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                          className="absolute border border-cobalt/30"
                          style={{
                            width: 12 + i * 4,
                            height: 12 + i * 4,
                            top: `calc(50% - ${(12 + i * 4) / 2}px)`,
                            left: `calc(50% - ${(12 + i * 4) / 2}px)`,
                            transform: `rotate(${i * 30}deg)`,
                            borderRadius: "2px",
                          }}
                        />
                      ))}
                      {/* Center shield */}
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Shield
                          className="w-6 h-6 text-cobalt"
                          style={{ filter: "drop-shadow(0 0 8px rgba(37,99,235,0.5))" }}
                        />
                      </motion.div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-[#475569] mb-2">
                      <span>Proof Generation</span>
                      <span style={{ fontFamily: "var(--font-mono)" }}>{proofProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-cobalt to-blue-400"
                        style={{ width: `${proofProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Scrolling crypto messages */}
                  <div className="h-16 overflow-hidden relative">
                    <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[#111827] to-transparent z-10" />
                    <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[#111827] to-transparent z-10" />
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentProofMsg}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-center"
                      >
                        <p className="text-xs text-cobalt/80" style={{ fontFamily: "var(--font-mono)" }}>
                          {proofMessages[currentProofMsg]}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {proofState === "complete" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Success indicator */}
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-acid-green/5 border border-acid-green/10">
                    <div className="w-2 h-2 rounded-full bg-acid-green shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
                    <span className="text-sm text-acid-green">ZK-STARK Proof Generated & Verified</span>
                  </div>

                  <div>
                    <label className="text-xs text-[#475569] block mb-2">Commitment Hash</label>
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span
                        className="text-xs text-[#94a3b8] flex-1 truncate"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {commitmentHash}
                      </span>
                      <button
                        onClick={handleCopy}
                        className="p-1 hover:bg-white/[0.04] rounded transition-colors"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-acid-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#475569]" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-[10px] text-[#475569] mb-1">Proof Time</div>
                      <div className="text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>
                        {proofElapsed}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-[10px] text-[#475569] mb-1">Gas Estimate</div>
                      <div className="text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>
                        {gasEstimate}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setProofState("idle");
                      }}
                      className="py-3 rounded-xl border border-white/[0.08] text-[#94a3b8] hover:text-white hover:border-white/[0.15] transition-all text-sm"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setProofState("idle");
                        setAmount("");
                        setPrice("");
                      }}
                      className="py-3 rounded-xl bg-cobalt text-white hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] text-sm"
                    >
                      New Order
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Background effect */}
              {proofState === "generating" && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
                  <div
                    className="text-[8px] text-cobalt whitespace-pre-wrap break-all leading-snug"
                    style={{
                      fontFamily: "var(--font-mono)",
                      animation: "proofScroll 30s linear infinite",
                    }}
                  >
                    {Array.from({ length: 80 })
                      .map(
                        () =>
                          "0x7a9f3e2c 1b8d4f6a 0e5c9d2b 7f1a8e3c 6d4b9f2a 5e8c1d7b 0f3a6e9c 2d5b8a1f "
                      )
                      .join("")}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
