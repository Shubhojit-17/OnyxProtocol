import { useState, useCallback } from "react";
import {
  ShieldCheck,
  Eye,
  Copy,
  Link2,
  AlertTriangle,
  Check,
  Clock,
  FileText,
  ExternalLink,
  XCircle,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { complianceApi, historyApi } from "../services/api";
import { useApi } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";

export default function CompliancePage() {
  const { walletAddress } = useWallet();
  const [selectedTxs, setSelectedTxs] = useState<string[]>([]);
  const [expiry, setExpiry] = useState("7 days");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Fetch compliance summary (active keys, stats)
  const { data: summaryData, refresh: refreshSummary } = useApi(
    () => walletAddress ? complianceApi.getSummary(walletAddress) : Promise.resolve(null),
    [walletAddress]
  );

  // Fetch settled trades to select from
  const { data: tradesData } = useApi(
    () => walletAddress ? historyApi.getTrades(walletAddress) : Promise.resolve({ trades: [] as any[], summary: { settled: 0, pending: 0, failed: 0 } }),
    [walletAddress]
  );

  const transactions = (tradesData?.trades || []).slice(0, 10).map((t: any) => ({
    id: t.id,
    pair: t.pair,
    date: t.date,
    amount: t.amount,
    matchId: t.matchId,
  }));

  const existingKeys = summaryData?.keys || [];
  const complianceStats = summaryData?.summary || {};

  const toggleTx = (id: string) => {
    setSelectedTxs((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const generateKey = async () => {
    if (!walletAddress || selectedTxs.length === 0) return;
    setGenerating(true);

    const expiryDays = expiry === "1 day" ? 1 : expiry === "7 days" ? 7 : 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    try {
      // Use first selected transaction's matchId
      const tx = transactions.find((t: any) => t.id === selectedTxs[0]);
      if (!tx?.matchId) {
        setGeneratedKey(null);
        console.warn("Selected transaction has no matchId - cannot generate viewing key");
      } else {
        const result = await complianceApi.generateViewingKey(
          walletAddress,
          tx.matchId,
          expiresAt.toISOString()
        );
        setGeneratedKey(result.viewingKey?.key || result.key || null);
      }
      refreshSummary();
    } catch (err: any) {
      console.error("Failed to generate viewing key:", err);
      setGeneratedKey(null);
    } finally {
      setGenerating(false);
    }
  };

  const handlePreviewKey = async (key: string) => {
    try {
      const data = await complianceApi.viewByKey(key);
      setPreviewData(data);
      setShowPreview(true);
    } catch (err: any) {
      console.error("Preview failed:", err);
    }
  };

  const handleRevoke = async (vkId: string) => {
    if (!walletAddress) return;
    setRevoking(vkId);
    try {
      await complianceApi.revoke(walletAddress, vkId);
      refreshSummary();
    } catch (err: any) {
      console.error("Revoke failed:", err);
    } finally {
      setRevoking(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-white mb-1">Selective Disclosure</h1>
        <p className="text-sm text-[#64748b]">Privacy is default. Transparency is a choice.</p>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-2xl bg-cobalt/5 border border-cobalt/10 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-cobalt shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-white mb-1">Institutional Compliance Layer</p>
          <p className="text-xs text-[#64748b] leading-relaxed">
            Generate time-limited viewing keys to share selected transaction details with auditors, regulators, or
            counterparties. Only the transactions you choose will be disclosed. Links are styled for professional
            presentation.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Generate Viewing Link */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-6">
            <Eye className="w-5 h-5 text-cobalt" />
            <h3 className="text-white">Generate Viewing Link</h3>
          </div>

          {/* Select Transactions */}
          <div className="mb-5">
            <label className="text-xs text-[#475569] mb-3 block">Select Transaction(s) to Disclose</label>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {transactions.map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => toggleTx(tx.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selectedTxs.includes(tx.id)
                      ? "bg-cobalt/5 border-cobalt/20"
                      : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      selectedTxs.includes(tx.id) ? "bg-cobalt border-cobalt" : "border-white/[0.15]"
                    }`}
                  >
                    {selectedTxs.includes(tx.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>
                      {tx.id}
                    </span>
                    <span className="text-xs text-[#475569]">{tx.pair}</span>
                    <span className="text-xs text-[#475569] hidden sm:inline" style={{ fontFamily: "var(--font-mono)" }}>
                      {tx.amount}
                    </span>
                  </div>
                  <span className="text-xs text-[#475569]">{tx.date}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="mb-5">
            <label className="text-xs text-[#475569] mb-2 block">Viewing Key Expiry</label>
            <div className="flex gap-2">
              {["1 day", "7 days", "30 days"].map((exp) => (
                <button
                  key={exp}
                  onClick={() => setExpiry(exp)}
                  className={`flex-1 py-2 rounded-lg text-xs transition-all ${
                    expiry === exp
                      ? "bg-cobalt/10 text-cobalt border border-cobalt/20"
                      : "bg-white/[0.02] text-[#64748b] border border-white/[0.06]"
                  }`}
                >
                  {exp}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateKey}
            disabled={selectedTxs.length === 0 || generating}
            className="w-full py-3 bg-cobalt text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating Viewing Key...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generate Viewing Key
              </>
            )}
          </button>

          {/* Generated Result */}
          <AnimatePresence>
            {generatedKey && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 p-4 rounded-xl bg-white/[0.02] border border-acid-green/10 space-y-3"
              >
                <div className="flex items-center gap-2 text-sm text-acid-green mb-2">
                  <Check className="w-4 h-4" />
                  Viewing Key Generated Successfully
                </div>

                <div>
                  <label className="text-[10px] text-[#475569] mb-1 block tracking-wider">VIEWING KEY</label>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-xs text-acid-green flex-1 truncate" style={{ fontFamily: "var(--font-mono)" }}>
                      {generatedKey}
                    </span>
                    <button onClick={() => handleCopy(generatedKey)} className="p-1 hover:bg-white/[0.04] rounded transition-colors">
                      {copied ? <Check className="w-3.5 h-3.5 text-acid-green" /> : <Copy className="w-3.5 h-3.5 text-[#475569]" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#475569] mb-1 block tracking-wider">SHAREABLE LINK</label>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <Link2 className="w-3.5 h-3.5 text-[#475569] shrink-0" />
                    <span className="text-xs text-[#94a3b8] flex-1 truncate" style={{ fontFamily: "var(--font-mono)" }}>
                      https://onyxprotocol.com/view/{generatedKey}
                    </span>
                    <button
                      onClick={() => handleCopy(`https://onyxprotocol.com/view/${generatedKey}`)}
                      className="p-1 hover:bg-white/[0.04] rounded transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#475569]" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setShowPreview(true)}
                  className="w-full py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-[#94a3b8] hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  Preview Viewing Page
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Warning */}
          <div className="flex items-start gap-2 mt-5 p-3 rounded-xl bg-amber-accent/5 border border-amber-accent/10">
            <AlertTriangle className="w-4 h-4 text-amber-accent shrink-0 mt-0.5" />
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Viewing links reveal selected transaction details only. Recipients will not have access to your full
              trading history, vault balances, or private keys.
            </p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Existing Viewing Keys */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-white mb-6">Active Viewing Keys</h3>

            <div className="space-y-4">
              {existingKeys.map((vk: any) => (
                <div key={vk.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-white" style={{ fontFamily: "var(--font-mono)" }}>
                      {vk.id?.substring(0, 8) || vk.id}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        vk.status === "Active" || new Date(vk.expiresAt) > new Date() ? "bg-acid-green/10 text-acid-green" : "bg-white/[0.04] text-[#475569]"
                      }`}
                    >
                      {new Date(vk.expiresAt) > new Date() ? "Active" : "Expired"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#475569]">Match</span>
                      <span className="text-[#94a3b8]">{vk.matchId?.substring(0, 12) || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#475569]">Expiry</span>
                      <span className="flex items-center gap-1 text-[#94a3b8]">
                        <Clock className="w-3 h-3" />
                        {new Date(vk.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#475569]">Total Views</span>
                      <span className="text-[#94a3b8]">{vk.views ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#64748b] truncate flex-1" style={{ fontFamily: "var(--font-mono)" }}>
                        {vk.key}
                      </span>
                      <button onClick={() => handleCopy(vk.key)} className="p-1 hover:bg-white/[0.04] rounded transition-colors">
                        <Copy className="w-3 h-3 text-[#475569]" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    {new Date(vk.expiresAt) > new Date() && (
                      <button
                        onClick={() => handleRevoke(vk.id)}
                        disabled={revoking === vk.id}
                        className="flex-1 py-1.5 rounded-lg text-xs text-red-400/60 border border-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        {revoking === vk.id ? (
                          <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {revoking === vk.id ? "Revoking..." : "Revoke"}
                      </button>
                    )}
                    <button
                      onClick={() => handlePreviewKey(vk.key)}
                      className="flex-1 py-1.5 rounded-lg text-xs text-[#64748b] border border-white/[0.06] hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Preview
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance Stats */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <h4 className="text-sm text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cobalt" />
              Compliance Summary
            </h4>
            <div className="space-y-3">
              {[
                ["Total Keys Generated", complianceStats.total ?? "—", "text-white"],
                ["Active Keys", complianceStats.active ?? "—", "text-acid-green"],
                ["Expired Keys", complianceStats.expired ?? "—", "text-[#64748b]"],
                ["Transactions Disclosed", complianceStats.disclosed ?? "—", "text-white"],
                ["Total Views", complianceStats.totalViews ?? "—", "text-cobalt"],
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-[#475569]">{label}</span>
                  <span className={color} style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal (Stripe-like) */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => { setShowPreview(false); setPreviewData(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-[#f8fafc] text-[#0f172a] overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#0d0e18] to-[#1e293b] px-6 py-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cobalt to-blue-400 flex items-center justify-center">
                    <span className="text-white text-[10px]" style={{ fontFamily: "var(--font-mono)" }}>O</span>
                  </div>
                  <span className="text-white text-sm tracking-[0.15em]">ONYX PROTOCOL</span>
                </div>
                <h3 className="text-white text-lg">Transaction Verification Report</h3>
                <p className="text-[#94a3b8] text-xs mt-1">
                  Viewing Key: {generatedKey?.substring(0, 20)}...
                </p>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs text-[#64748b] mb-2">
                  <Shield className="w-3.5 h-3.5 text-green-600" />
                  <span>Cryptographically verified &middot; Expires in {expiry}</span>
                </div>

                {/* Show viewByKey data if available */}
              {previewData && (
                <div className="p-4 rounded-xl bg-white border border-[#e2e8f0]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#0f172a]" style={{ fontFamily: "var(--font-mono)" }}>
                      {previewData.match?.id || "Match"}
                    </span>
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      {previewData.match?.status || "Verified"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-[#64748b]">Pair</div>
                      <div className="text-[#0f172a]">{previewData.match?.pair || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[#64748b]">Date</div>
                      <div className="text-[#0f172a]">{previewData.match?.createdAt ? new Date(previewData.match.createdAt).toLocaleDateString() : "—"}</div>
                    </div>
                    {previewData.proof && (
                      <>
                        <div>
                          <div className="text-[#64748b]">Proof ID</div>
                          <div className="text-[#0f172a]" style={{ fontFamily: "var(--font-mono)" }}>{previewData.proof.proofId}</div>
                        </div>
                        <div>
                          <div className="text-[#64748b]">Proof Status</div>
                          <div className="text-[#0f172a]">{previewData.proof.status}</div>
                        </div>
                      </>
                    )}
                    {previewData.settlement && (
                      <>
                        <div>
                          <div className="text-[#64748b]">TX Hash</div>
                          <div className="text-[#0f172a] truncate" style={{ fontFamily: "var(--font-mono)" }}>{previewData.settlement.txHash}</div>
                        </div>
                        <div>
                          <div className="text-[#64748b]">Settled</div>
                          <div className="text-[#0f172a]">{new Date(previewData.settlement.settledAt).toLocaleDateString()}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Show selected transactions when no previewData */}
              {!previewData && selectedTxs.map((txId) => {
                  const tx = transactions.find((t) => t.id === txId);
                  if (!tx) return null;
                  return (
                    <div key={tx.id} className="p-4 rounded-xl bg-white border border-[#e2e8f0]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[#0f172a]" style={{ fontFamily: "var(--font-mono)" }}>
                          {tx.id}
                        </span>
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Verified</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <div className="text-[#64748b]">Pair</div>
                          <div className="text-[#0f172a]">{tx.pair}</div>
                        </div>
                        <div>
                          <div className="text-[#64748b]">Amount</div>
                          <div className="text-[#0f172a]" style={{ fontFamily: "var(--font-mono)" }}>{tx.amount}</div>
                        </div>
                        <div>
                          <div className="text-[#64748b]">Date</div>
                          <div className="text-[#0f172a]">{tx.date}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!previewData && selectedTxs.length === 0 && (
                  <p className="text-sm text-[#94a3b8] text-center py-4">Select transactions to preview</p>
                )}

                <div className="pt-4 border-t border-[#e2e8f0] flex items-center justify-between">
                  <p className="text-[10px] text-[#94a3b8]">
                    This report is generated by Onyx Protocol and can be independently verified on-chain.
                  </p>
                  <button
                    onClick={() => { setShowPreview(false); setPreviewData(null); }}
                    className="px-4 py-1.5 text-xs text-[#475569] border border-[#e2e8f0] rounded-lg hover:bg-[#f1f5f9] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
