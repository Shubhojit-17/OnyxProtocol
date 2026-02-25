import { useState, useCallback, useEffect, useRef } from "react";
import {
  Lock,
  CircleDot,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
  Inbox,
  Play,
  Trash2,
  X,
  Loader2,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { executionApi, orderApi } from "../services/api";
import { useApi, useMutation } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";
import { useWebSocket } from "../hooks/useWebSocket";

const stepIcons = [Lock, CircleDot, Cpu, ShieldCheck, CheckCircle2];

const provingTexts = [
  "FRI-domain expansion...",
  "Generating witness...",
  "Polynomial commitment...",
  "Merkle tree build...",
];

export default function ExecutionPage() {
  const { walletAddress } = useWallet();
  const [expandedExec, setExpandedExec] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [proofModal, setProofModal] = useState<any>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: timelineData, refresh: refreshTimeline } = useApi(
    () => walletAddress ? executionApi.getTimeline(walletAddress) : Promise.resolve({ executions: [] }),
    [walletAddress]
  );

  const { data: statsData, refresh: refreshStats } = useApi(
    () => executionApi.getStats(),
    []
  );

  useWebSocket(
    useCallback(() => { refreshTimeline(); refreshStats(); }, [refreshTimeline, refreshStats]),
    ["order:matched", "proof:generating", "proof:generated", "proof:verified", "settlement:confirmed", "vault:updated", "order:cancelled", "match:failed"]
  );

  const executions: any[] = timelineData?.executions || [];

  // Auto-poll every 3s while there are active (non-settled) executions
  const hasActiveRef = useRef(false);
  hasActiveRef.current = executions.some(
    (e: any) => e.status && !["Settled", "Expired", "Failed"].includes(e.status)
  );
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasActiveRef.current) {
        refreshTimeline();
        refreshStats();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [refreshTimeline, refreshStats]);

  const { mutate: triggerMatcher, loading: matcherRunning } = useMutation(async (_: void) => {
    const res = await executionApi.runMatcher();
    refreshTimeline();
    refreshStats();
    return res;
  });

  const handleCancel = async (orderId: string) => {
    if (!walletAddress) return;
    setCancellingId(orderId);
    try {
      await orderApi.cancel(walletAddress, orderId);
      refreshTimeline();
      refreshStats();
    } catch (err: any) {
      console.error("Cancel failed:", err);
    } finally {
      setCancellingId(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white mb-1">Execution & Proof Timeline</h1>
          <p className="text-sm text-[#64748b]">ZK proof execution pipeline and settlement verification</p>
        </div>
        <button
          onClick={() => triggerMatcher(undefined)}
          disabled={matcherRunning}
          className="flex items-center gap-2 px-4 py-2 bg-cobalt text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] text-sm disabled:opacity-50"
        >
          {matcherRunning ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {matcherRunning ? "Matching..." : "Run Matcher"}
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Active Proofs", value: statsData?.activeProofs ?? "—", color: "text-cobalt" },
          { label: "Settled Today", value: statsData?.settledToday ?? "—", color: "text-acid-green" },
          { label: "Avg Proof Time", value: statsData?.avgProofTime ?? "—", color: "text-white" },
          { label: "Success Rate", value: statsData?.successRate ?? "—", color: "text-acid-green" },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="text-xs text-[#475569] mb-1">{stat.label}</div>
            <div className={`text-lg ${stat.color}`} style={{ fontFamily: "var(--font-mono)" }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {executions.length === 0 && (
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-16 flex flex-col items-center justify-center text-center">
            <Inbox className="w-12 h-12 text-[#334155] mb-4" />
            <p className="text-sm text-[#64748b] mb-1">No executions yet</p>
            <p className="text-xs text-[#475569] mb-4">Create buy and sell orders on the Trade page. When a matching pair is found, the execution pipeline will start automatically.</p>
            <button
              onClick={() => triggerMatcher(undefined)}
              disabled={matcherRunning}
              className="flex items-center gap-2 px-4 py-2 bg-cobalt/10 text-cobalt rounded-xl hover:bg-cobalt/20 transition-all text-sm disabled:opacity-50"
            >
              {matcherRunning ? (
                <div className="w-3.5 h-3.5 border-2 border-cobalt/30 border-t-cobalt rounded-full animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {matcherRunning ? "Running..." : "Run Matcher Now"}
            </button>
          </div>
        )}
        {executions.map((exec) => {
          const isExpanded = expandedExec === exec.id;
          return (
            <motion.div
              key={exec.id}
              layout
              className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden"
            >
              {/* Header - always visible */}
              <button
                onClick={() => setExpandedExec(isExpanded ? null : exec.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.01] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      exec.status === "Settled"
                        ? "bg-acid-green/10 border border-acid-green/20"
                        : exec.status === "Failed"
                        ? "bg-red-500/10 border border-red-500/20"
                        : exec.status === "Proving" || exec.status === "Verified"
                        ? "bg-cobalt/10 border border-cobalt/20"
                        : exec.status === "Awaiting Match"
                        ? "bg-amber-accent/10 border border-amber-accent/20"
                        : "bg-amber-accent/10 border border-amber-accent/20"
                    }`}
                  >
                    {exec.status === "Settled" ? (
                      <CheckCircle2 className="w-5 h-5 text-acid-green" />
                    ) : exec.status === "Failed" ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : exec.status === "Proving" || exec.status === "Verified" ? (
                      <Cpu className="w-5 h-5 text-cobalt animate-pulse" />
                    ) : exec.status === "Awaiting Match" ? (
                      <Clock className="w-5 h-5 text-amber-accent animate-pulse" />
                    ) : (
                      <CircleDot className="w-5 h-5 text-amber-accent" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>
                        {exec.proofId}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          exec.status === "Settled"
                            ? "bg-acid-green/10 text-acid-green"
                            : exec.status === "Failed"
                            ? "bg-red-500/10 text-red-400"
                            : exec.status === "Proving" || exec.status === "Verified"
                            ? "bg-cobalt/10 text-cobalt"
                            : exec.status === "Awaiting Match"
                            ? "bg-amber-accent/10 text-amber-accent"
                            : "bg-amber-accent/10 text-amber-accent"
                        }`}
                      >
                        {exec.status === "Failed" ? "Failed — Refunded" : exec.status}
                      </span>
                      {exec.isPartialFill && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-accent/10 text-amber-accent">
                          Partial Fill
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#475569]">
                      <span>{exec.pair}</span>
                      <span>&middot;</span>
                      <span>{exec.amount}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {exec.status === "Awaiting Match" && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (cancellingId === exec.orderId) return;
                        if (cancellingId === `confirm-${exec.orderId}`) {
                          handleCancel(exec.orderId);
                        } else {
                          setCancellingId(`confirm-${exec.orderId}`);
                          setTimeout(() => setCancellingId((prev) => prev === `confirm-${exec.orderId}` ? null : prev), 4000);
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        cancellingId === exec.orderId
                          ? "bg-white/5 text-[#475569] cursor-wait"
                          : cancellingId === `confirm-${exec.orderId}`
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-white/5 text-[#94a3b8] hover:bg-red-500/10 hover:text-red-400"
                      }`}
                    >
                      {cancellingId === exec.orderId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : cancellingId === `confirm-${exec.orderId}` ? (
                        <>
                          <X className="w-3.5 h-3.5" />
                          <span>Confirm Cancel</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </>
                      )}
                    </div>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#475569]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#475569]" />
                  )}
                </div>
              </button>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="grid lg:grid-cols-3 gap-6 p-5 pt-0">
                      {/* Timeline */}
                      <div className="lg:col-span-2">
                        <div className="relative">
                          {/* Connecting line */}
                          <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-cobalt/30 via-white/[0.06] to-white/[0.02]" />

                          <div className="space-y-5">
                            {exec.steps.map((step: any, i: number) => {
                              const Icon = stepIcons[i];
                              return (
                                <motion.div
                                  key={step.name}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.08 }}
                                  className="flex items-start gap-4 relative"
                                >
                                  <div
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10 ${
                                      step.status === "done"
                                        ? "bg-acid-green/10 border border-acid-green/20"
                                        : step.status === "active"
                                        ? "bg-cobalt/10 border border-cobalt/20"
                                        : step.status === "failed"
                                        ? "bg-red-500/10 border border-red-500/20"
                                        : "bg-white/[0.02] border border-white/[0.06]"
                                    }`}
                                    style={
                                      step.status === "active"
                                        ? { animation: "glowPulse 2s ease-in-out infinite" }
                                        : undefined
                                    }
                                  >
                                    <Icon
                                      className={`w-4 h-4 ${
                                        step.status === "done"
                                          ? "text-acid-green"
                                          : step.status === "active"
                                          ? "text-cobalt"
                                          : step.status === "failed"
                                          ? "text-red-400"
                                          : "text-[#334155]"
                                      }`}
                                    />
                                  </div>
                                  <div className="flex-1 pt-1">
                                    <div className="flex items-center justify-between">
                                      <span
                                        className={`text-sm ${
                                          step.status === "done"
                                            ? "text-white"
                                            : step.status === "active"
                                            ? "text-cobalt"
                                            : step.status === "failed"
                                            ? "text-red-400"
                                            : "text-[#475569]"
                                        }`}
                                      >
                                        {step.name}
                                      </span>
                                      <span
                                        className="text-xs text-[#475569]"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                      >
                                        {step.time}
                                      </span>
                                    </div>
                                    <p className="text-xs text-[#475569] mt-0.5">
                                      {step.txHash ? (
                                        <a
                                          href={`https://sepolia.voyager.online/tx/${step.txHash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-cobalt hover:text-blue-400 underline underline-offset-2 decoration-cobalt/30 inline-flex items-center gap-1"
                                          style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                          {step.detail}
                                          <ExternalLink className="w-3 h-3 inline shrink-0" />
                                        </a>
                                      ) : (
                                        step.detail
                                      )}
                                    </p>
                                    {step.status === "done" && (
                                      <span className="text-xs text-acid-green mt-0.5 inline-flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Verified
                                      </span>
                                    )}
                                    {step.status === "failed" && (
                                      <span className="text-xs text-red-400 mt-0.5 inline-flex items-center gap-1">
                                        <XCircle className="w-3 h-3" /> {step.detail || "Failed"}
                                      </span>
                                    )}
                                    {step.status === "active" && step.name === "Proving" && (
                                      <div className="mt-2 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                                            <div
                                              className="h-full bg-cobalt rounded-full"
                                              style={{
                                                width: step.progress ? `${step.progress}%` : "0%",
                                                animation: "shimmer 2s ease-in-out infinite",
                                                backgroundSize: "200% 100%",
                                                backgroundImage:
                                                  "linear-gradient(90deg, #2563eb 0%, #60a5fa 50%, #2563eb 100%)",
                                              }}
                                            />
                                          </div>
                                          <span className="text-xs text-cobalt" style={{ fontFamily: "var(--font-mono)" }}>
                                            {step.progress ? `${step.progress}%` : "..."}
                                          </span>
                                        </div>
                                        {/* Scrolling proof text */}
                                        <div className="overflow-hidden h-4">
                                          <div
                                            className="text-[10px] text-cobalt/50"
                                            style={{
                                              fontFamily: "var(--font-mono)",
                                              animation: "proofScroll 8s linear infinite",
                                            }}
                                          >
                                            {provingTexts.map((t, j) => (
                                              <div key={j}>{t}</div>
                                            ))}
                                            {provingTexts.map((t, j) => (
                                              <div key={`dup-${j}`}>{t}</div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {step.status === "active" && (step.name === "Searching Pool" || step.name === "Match Found") && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="w-16 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                                          <div className="w-1/2 h-full bg-amber-accent rounded-full animate-pulse" />
                                        </div>
                                        <span className="text-xs text-amber-accent">Scanning dark pool...</span>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Certificate */}
                      <div>
                        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                          <h4 className="text-white mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-cobalt" />
                            Execution Certificate
                          </h4>

                          {exec.certificate ? (
                            <div className="space-y-3">
                              <div>
                                <label className="text-[10px] text-[#475569] mb-1 block tracking-wider">
                                  PROOF ID
                                </label>
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                  <span
                                    className="text-xs text-[#94a3b8] truncate flex-1"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                  >
                                    {exec.certificate.proofId}
                                  </span>
                                  <button
                                    onClick={() => handleCopy(exec.certificate!.proofId, "proof")}
                                    className="p-1 hover:bg-white/[0.04] rounded transition-colors"
                                  >
                                    {copiedId === "proof" ? (
                                      <Check className="w-3 h-3 text-acid-green" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-[#475569]" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {[
                                ["Verification", exec.certificate.result, "text-acid-green"],
                                ["Gas Used", exec.certificate.gasUsed, "text-white"],
                                ["Proof Size", exec.certificate.proofSize, "text-white"],
                                ["Verifier", exec.certificate.verifier, "text-cobalt"],
                              ].map(([label, value, color]) => (
                                <div
                                  key={label}
                                  className="flex items-center justify-between py-2 border-b border-white/[0.04]"
                                >
                                  <span className="text-[10px] text-[#475569]">{label}</span>
                                  <span
                                    className={`text-xs ${color}`}
                                    style={{ fontFamily: "var(--font-mono)" }}
                                  >
                                    {label === "Verification" ? (
                                      <span className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-acid-green shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
                                        {value}
                                      </span>
                                    ) : (
                                      value
                                    )}
                                  </span>
                                </div>
                              ))}

                              <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                                <span className="text-[10px] text-[#475569]">Time to Verify</span>
                                <span className="flex items-center gap-1.5 text-xs text-white">
                                  <Clock className="w-3 h-3 text-acid-green" />
                                  <span style={{ fontFamily: "var(--font-mono)" }}>
                                    {exec.certificate.timeToVerify}
                                  </span>
                                </span>
                              </div>

                              <div>
                                <label className="text-[10px] text-[#475569] mb-1 block tracking-wider">
                                  TX HASH
                                </label>
                                {exec.certificate.fullTxHash ? (
                                  <a
                                    href={`https://sepolia.voyager.online/tx/${exec.certificate.fullTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-cobalt/30 hover:bg-cobalt/5 transition-all group cursor-pointer"
                                  >
                                    <span
                                      className="text-xs text-cobalt group-hover:text-blue-400 truncate flex-1 underline underline-offset-2 decoration-cobalt/30"
                                      style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                      {exec.certificate.txHash}
                                    </span>
                                    <ExternalLink className="w-3.5 h-3.5 text-cobalt/60 group-hover:text-cobalt shrink-0 transition-colors" />
                                  </a>
                                ) : (
                                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                    <span
                                      className="text-xs text-[#475569] truncate flex-1"
                                      style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                      Pending...
                                    </span>
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => setProofModal(exec.certificate)}
                                className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-[#94a3b8] hover:text-white hover:border-white/[0.1] transition-all mt-2"
                              >
                                View Full Proof Metadata
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                                <Clock className="w-5 h-5 text-[#334155]" />
                              </div>
                              <p className="text-sm text-[#475569] mb-1">Certificate Pending</p>
                              <p className="text-xs text-[#334155]">Awaiting proof verification</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Proof Metadata Modal */}
      <AnimatePresence>
        {proofModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setProofModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-2xl bg-[#111827] border border-white/[0.08] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cobalt" />
                  Proof Metadata
                </h3>
                <button onClick={() => setProofModal(null)} className="p-1 rounded-lg hover:bg-white/[0.04] transition-colors text-[#475569] hover:text-white">
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                {[
                  ["Proof ID", proofModal.proofId],
                  ["Verification", proofModal.result],
                  ["Gas Used", proofModal.gasUsed],
                  ["Proof Size", proofModal.proofSize],
                  ["Verifier", proofModal.verifier],
                  ["Time to Verify", proofModal.timeToVerify],
                  ["TX Hash", proofModal.fullTxHash || proofModal.txHash],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                    <span className="text-xs text-[#475569]">{label}</span>
                    {label === "TX Hash" && value ? (
                      <a
                        href={`https://sepolia.voyager.online/tx/${value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cobalt hover:text-blue-400 max-w-[220px] truncate underline underline-offset-2 decoration-cobalt/30 flex items-center gap-1"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {String(value).slice(0, 10)}...{String(value).slice(-8)}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-[#94a3b8] max-w-[220px] truncate" style={{ fontFamily: "var(--font-mono)" }}>{value || "—"}</span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setProofModal(null)}
                className="w-full mt-5 py-2.5 rounded-xl border border-white/[0.08] text-sm text-[#94a3b8] hover:text-white transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
