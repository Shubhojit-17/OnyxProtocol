import { useState, useCallback, useEffect } from "react";
import {
  Vault,
  ArrowDownToLine,
  ArrowUpFromLine,
  Shield,
  ShieldOff,
  Eye,
  EyeOff,
  Lock,
  TrendingUp,
  Coins,
  Info,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { vaultApi } from "../services/api";
import { useApi } from "../hooks/useApi";
import { useMutation } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  vaultDepositOnChain,
  vaultWithdrawOnChain,
  getWalletTokenBalance,
  getVaultBalance,
  toTokenAmount,
  fromTokenAmount,
  getTxExplorerUrl,
} from "../services/starknet.service";
import { TOKEN_ADDRESSES } from "../services/starknet.config";

const actions = [
  {
    title: "Deposit",
    description: "Transfer tokens from wallet into vault (on-chain)",
    icon: ArrowDownToLine,
    color: "#4ade80",
    action: "deposit" as const,
  },
  {
    title: "Withdraw",
    description: "Withdraw tokens from vault to wallet (on-chain)",
    icon: ArrowUpFromLine,
    color: "#f59e0b",
    action: "withdraw" as const,
  },
  {
    title: "Shield Funds",
    description: "Move to shielded balance (private)",
    icon: Shield,
    color: "#2563eb",
    action: "shield" as const,
  },
  {
    title: "Unshield Funds",
    description: "Move to public balance (visible)",
    icon: ShieldOff,
    color: "#94a3b8",
    action: "unshield" as const,
  },
];

export default function VaultPage() {
  const { walletAddress, account } = useWallet();
  const [privacyMode, setPrivacyMode] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("STRK");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({ STRK: 0, ETH: 0 });

  // Fetch vault balances from API
  const { data: balancesData, refresh: refreshBalances } = useApi(
    () => walletAddress ? vaultApi.getBalances(walletAddress) : Promise.resolve(null),
    [walletAddress]
  );

  // Fetch recent activity
  const { data: activityData, refresh: refreshActivity } = useApi(
    () => walletAddress ? vaultApi.getActivity(walletAddress) : Promise.resolve([]),
    [walletAddress]
  );

  // Fetch wallet ERC20 balances
  useEffect(() => {
    if (!walletAddress) return;
    const fetchWalletBalances = async () => {
      try {
        const [strkBal, ethBal] = await Promise.all([
          getWalletTokenBalance(walletAddress, "STRK"),
          getWalletTokenBalance(walletAddress, "ETH"),
        ]);
        setWalletBalances({
          STRK: fromTokenAmount(strkBal, "STRK"),
          ETH: fromTokenAmount(ethBal, "ETH"),
        });
      } catch (err) {
        console.error("Failed to fetch wallet balances:", err);
      }
    };
    fetchWalletBalances();
    const interval = setInterval(fetchWalletBalances, 30000);
    return () => clearInterval(interval);
  }, [walletAddress, actionSuccess]);

  // Listen for vault updates
  useWebSocket(
    useCallback(() => { refreshBalances(); refreshActivity(); }, [refreshBalances, refreshActivity]),
    ["vault:updated", "activity:new"]
  );

  const balances = balancesData?.balances || [];
  const summary = {
    publicTotal: balancesData?.totalPublic || "0.000",
    publicUsd: balancesData?.totalPublicUsd ? `$${Number(balancesData.totalPublicUsd).toLocaleString()}` : "$0",
    shieldedTotal: balancesData?.totalShielded || "0.000",
    shieldedUsd: balancesData?.totalShieldedUsd ? `$${Number(balancesData.totalShieldedUsd).toLocaleString()}` : "$0",
    lockedTotal: balancesData?.totalLocked || "0.000",
    lockedUsd: balancesData?.totalLockedUsd ? `$${Number(balancesData.totalLockedUsd).toLocaleString()}` : "$0",
  };
  const recentActivity = activityData || [];

  const handleAction = async () => {
    if (!walletAddress || !actionAmount || !selectedAsset) return;
    const actionDef = actions.find((a) => a.title === activeAction);
    if (!actionDef) return;

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    setLastTxHash(null);

    try {
      const amount = parseFloat(actionAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Enter a valid amount greater than 0");

      if (actionDef.action === "deposit") {
        // On-chain ERC20 deposit
        if (!account) throw new Error("Wallet not connected. Please connect your Starknet wallet.");
        const tokenAmount = toTokenAmount(amount, selectedAsset);
        const result = await vaultDepositOnChain(account, selectedAsset, tokenAmount);
        setLastTxHash(result.transactionHash);
        // Sync with backend
        await vaultApi.deposit(walletAddress, selectedAsset, amount);
      } else if (actionDef.action === "withdraw") {
        // On-chain ERC20 withdrawal
        if (!account) throw new Error("Wallet not connected. Please connect your Starknet wallet.");
        const tokenAmount = toTokenAmount(amount, selectedAsset);
        const result = await vaultWithdrawOnChain(account, selectedAsset, tokenAmount);
        setLastTxHash(result.transactionHash);
        // Sync with backend
        await vaultApi.withdraw(walletAddress, selectedAsset, amount);
      } else {
        // Shield/Unshield are backend-only operations
        await vaultApi[actionDef.action](walletAddress, selectedAsset, amount);
      }

      setActionAmount("");
      setActionSuccess(`${actionDef.title} succeeded!`);
      setTimeout(() => { setActionSuccess(null); setLastTxHash(null); }, 8000);
      refreshBalances();
      refreshActivity();
    } catch (err: any) {
      setActionError(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRowAction = (assetSymbol: string, action: "shield" | "unshield") => {
    setSelectedAsset(assetSymbol);
    setActiveAction(action === "shield" ? "Shield Funds" : "Unshield Funds");
    setActionAmount("");
    setActionError(null);
    setActionSuccess(null);
  };

  const getAvailableBalance = () => {
    const bal = balances.find((b: any) => b.assetSymbol === selectedAsset);
    const actionDef = actions.find((a) => a.title === activeAction);
    if (!actionDef) return 0;
    if (actionDef.action === "deposit") return walletBalances[selectedAsset] || 0;
    if (actionDef.action === "shield") return bal ? parseFloat(bal.publicBalance) || 0 : 0;
    if (actionDef.action === "unshield") return bal ? parseFloat(bal.shieldedBalance) || 0 : 0;
    if (actionDef.action === "withdraw") return bal ? parseFloat(bal.publicBalance) || 0 : 0;
    return 0;
  };

  const blurClass = privacyMode ? "blur-md select-none hover:blur-none transition-all duration-300 cursor-pointer" : "";
  const blurClassStrict = privacyMode ? "blur-md select-none" : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl text-white mb-1">Private Vault</h1>
          <p className="text-sm text-[#64748b]">
            Manage deposits, withdrawals, and shielded token balances — real ERC20 on Starknet Sepolia
          </p>
        </div>
        <button
          onClick={() => setPrivacyMode(!privacyMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
            privacyMode
              ? "bg-cobalt/10 border-cobalt/20 text-cobalt shadow-[0_0_15px_rgba(37,99,235,0.15)]"
              : "bg-white/[0.02] border-white/[0.06] text-[#64748b] hover:text-white"
          }`}
        >
          {privacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span className="text-sm">Privacy Mode</span>
        </button>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Vault className="w-4 h-4 text-[#64748b]" />
            <span className="text-xs text-[#475569]">Public Starknet Balance</span>
          </div>
          <div className={`text-2xl text-white mb-1 transition-all ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
            {summary.publicTotal}
          </div>
          <div className={`text-sm text-[#64748b] transition-all ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
            {summary.publicUsd}
          </div>
          {privacyMode && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0b14]/20 backdrop-blur-[1px] pointer-events-none opacity-0 hover:opacity-0">
              <Eye className="w-5 h-5 text-[#475569]" />
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-cobalt/5 to-transparent border border-cobalt/10 relative">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-cobalt" />
            <span className="text-xs text-[#475569]">Shielded Onyx Balance</span>
          </div>
          <div className={`text-2xl text-white mb-1 transition-all ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
            {summary.shieldedTotal}
          </div>
          <div className={`text-sm text-cobalt transition-all ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
            {summary.shieldedUsd}
          </div>
          {/* Subtle shield glow */}
          <div className="absolute top-3 right-3">
            <Shield className="w-16 h-16 text-cobalt/[0.04]" />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-amber-accent" />
            <span className="text-xs text-[#475569]">Locked in Orders</span>
          </div>
          <div className={`text-2xl text-white mb-1 transition-all ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
            {summary.lockedTotal}
          </div>
          <div className={`text-sm text-amber-accent transition-all ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
            {summary.lockedUsd}
          </div>
        </div>
      </div>

      {/* Token Balances Breakdown */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <h3 className="text-white mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5 text-cobalt" />
          Token Balances
        </h3>

        {/* Wallet balances */}
        <div className="mb-4 p-3 rounded-xl bg-cobalt/5 border border-cobalt/10">
          <div className="text-xs text-[#475569] mb-2">Wallet Balance (Argent X / Braavos)</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-[#94a3b8]">STRK: </span>
              <span className={`text-sm text-white ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
                {walletBalances.STRK.toFixed(4)}
              </span>
            </div>
            <div>
              <span className="text-xs text-[#94a3b8]">ETH: </span>
              <span className={`text-sm text-white ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
                {walletBalances.ETH.toFixed(6)}
              </span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Asset", "Total Balance", "USD Value", "Shielded", "Public", ""].map((h) => (
                  <th key={h} className="text-left text-xs text-[#475569] px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balances.map((asset: any) => (
                <tr key={asset.assetSymbol} className="border-b border-white/[0.03]">
                  <td className="px-4 py-3">
                    <span className="text-sm text-white">{asset.assetSymbol}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm text-white ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
                      {parseFloat(asset.publicBalance) + parseFloat(asset.shieldedBalance)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm text-[#94a3b8] ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
                      ${((parseFloat(asset.publicBalance) + parseFloat(asset.shieldedBalance)) * (asset.usdPrice || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm text-cobalt ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
                      {asset.shieldedBalance}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm text-[#94a3b8] ${blurClass}`} style={{ fontFamily: "var(--font-mono)" }}>
                      {asset.publicBalance}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRowAction(asset.assetSymbol, parseFloat(asset.publicBalance) > 0 ? "shield" : "unshield")}
                      className="text-xs text-cobalt hover:text-blue-400 transition-colors"
                    >
                      {parseFloat(asset.publicBalance) > 0 ? "Shield" : "Unshield"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={() => setActiveAction(activeAction === action.title ? null : action.title)}
            className={`group p-5 rounded-2xl border text-left transition-all duration-300 hover:-translate-y-1 ${
              activeAction === action.title
                ? "bg-white/[0.04] border-cobalt/20"
                : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]"
            }`}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-shadow group-hover:shadow-lg"
              style={{
                backgroundColor: `${action.color}10`,
                border: `1px solid ${action.color}30`,
              }}
            >
              <action.icon className="w-5 h-5" style={{ color: action.color }} />
            </div>
            <h4 className="text-white text-sm mb-1">{action.title}</h4>
            <p className="text-xs text-[#475569]">{action.description}</p>
          </button>
        ))}
      </div>

      {/* Action Form */}
      <AnimatePresence>
        {activeAction && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <h3 className="text-white mb-4">{activeAction}</h3>
              <div className="max-w-md space-y-4">
                {/* Asset selector */}
                <div>
                  <label className="text-xs text-[#475569] mb-2 block">Asset</label>
                  <div className="flex gap-2">
                    {["STRK", "ETH"].map((a) => (
                      <button
                        key={a}
                        onClick={() => setSelectedAsset(a)}
                        className={`px-4 py-2 rounded-lg text-sm transition-all ${
                          selectedAsset === a
                            ? "bg-cobalt/10 text-cobalt border border-cobalt/20"
                            : "bg-white/[0.02] text-[#64748b] border border-white/[0.06]"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#475569] mb-2 block">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={actionAmount}
                      onChange={(e) => setActionAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-[#334155] focus:outline-none focus:border-cobalt/40"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#475569]">
                      {selectedAsset}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        const avail = getAvailableBalance();
                        setActionAmount(((avail * pct) / 100).toFixed(6));
                      }}
                      className="flex-1 py-2 rounded-lg text-xs text-[#64748b] bg-white/[0.02] border border-white/[0.06] hover:text-white transition-colors"
                    >
                      {pct === 100 ? "Max" : `${pct}%`}
                    </button>
                  ))}
                </div>

                {activeAction === "Shield Funds" && (
                  <div className="p-3 rounded-xl bg-cobalt/5 border border-cobalt/10 flex gap-2">
                    <Info className="w-4 h-4 text-cobalt shrink-0 mt-0.5" />
                    <p className="text-xs text-[#94a3b8]">
                      Shielded funds are protected by ZK commitments. They remain in your vault
                      but are invisible to other participants until you choose to unshield.
                    </p>
                  </div>
                )}

                {activeAction === "Unshield Funds" && (
                  <div className="p-3 rounded-xl bg-amber-accent/5 border border-amber-accent/10 flex gap-2">
                    <Info className="w-4 h-4 text-amber-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-[#94a3b8]">
                      Unshielding moves assets back to the public Starknet layer. This action
                      will be visible on-chain.
                    </p>
                  </div>
                )}

                {(activeAction === "Deposit" || activeAction === "Withdraw") && (
                  <div className="p-3 rounded-xl bg-acid-green/5 border border-acid-green/10 flex gap-2">
                    <Info className="w-4 h-4 text-acid-green shrink-0 mt-0.5" />
                    <p className="text-xs text-[#94a3b8]">
                      {activeAction === "Deposit"
                        ? `This will execute an on-chain ERC20 approve + transfer of ${selectedAsset} tokens from your wallet to the Onyx vault contract. Your wallet will prompt for signature.`
                        : `This will execute an on-chain transfer of ${selectedAsset} tokens from the Onyx vault contract back to your wallet.`}
                    </p>
                  </div>
                )}

                {/* Available balance info */}
                <div className="text-xs text-[#475569]">
                  Available: <span className="text-white" style={{ fontFamily: "var(--font-mono)" }}>
                    {getAvailableBalance().toFixed(6)} {selectedAsset}
                  </span>
                  {(activeAction === "Deposit") && (
                    <span className="text-[#475569]"> (wallet balance)</span>
                  )}
                </div>

                {actionError && (
                  <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                    <p className="text-xs text-red-400">{actionError}</p>
                  </div>
                )}

                {actionSuccess && (
                  <div className="p-3 rounded-xl bg-acid-green/5 border border-acid-green/10 space-y-2">
                    <p className="text-xs text-acid-green">{actionSuccess}</p>
                    {lastTxHash && (
                      <a
                        href={getTxExplorerUrl(lastTxHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-cobalt hover:text-blue-400 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View on Starkscan
                      </a>
                    )}
                  </div>
                )}

                <button
                  onClick={handleAction}
                  disabled={actionLoading || !actionAmount}
                  className="w-full py-3 bg-cobalt text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  {actionLoading
                    ? (activeAction === "Deposit" || activeAction === "Withdraw")
                      ? "Awaiting wallet signature..."
                      : "Processing..."
                    : `Confirm ${activeAction}`}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Activity */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <h3 className="text-white mb-4">Recent Vault Activity</h3>
        <div className="space-y-3">
          {recentActivity.map((activity: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between py-3 border-b border-white/[0.03] last:border-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    activity.type === "Deposit"
                      ? "bg-acid-green/10"
                      : activity.type === "Shield"
                      ? "bg-cobalt/10"
                      : "bg-amber-accent/10"
                  }`}
                >
                  {activity.type === "Deposit" ? (
                    <ArrowDownToLine className="w-4 h-4 text-acid-green" />
                  ) : activity.type === "Shield" ? (
                    <Shield className="w-4 h-4 text-cobalt" />
                  ) : (
                    <ArrowUpFromLine className="w-4 h-4 text-amber-accent" />
                  )}
                </div>
                <div>
                  <div className="text-sm text-white">{activity.type}</div>
                  <div className="text-xs text-[#475569]">{activity.time}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div
                    className={`text-sm ${blurClassStrict} ${
                      activity.amount.startsWith("+") ? "text-acid-green" : activity.amount.startsWith("-") ? "text-red-400" : "text-white"
                    }`}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {activity.amount}
                  </div>
                  <div className={`text-xs text-[#475569] ${blurClassStrict}`} style={{ fontFamily: "var(--font-mono)" }}>
                    {activity.usd}
                  </div>
                </div>
                <span className="text-xs text-[#475569] hidden sm:inline" style={{ fontFamily: "var(--font-mono)" }}>
                  {activity.hash}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
