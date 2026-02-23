import { Search, Bell, Sun, Moon, Wifi, Copy, Check, LogOut } from "lucide-react";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useWallet } from "../../hooks/useWallet";
import { useWebSocket } from "../../hooks/useWebSocket";

interface Notification {
  text: string;
  time: string;
  type: "success" | "info" | "warning";
}

export default function TopHeader() {
  const [darkMode, setDarkMode] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { walletAddress, isConnected, disconnect } = useWallet();
  const navigate = useNavigate();

  // Listen for WebSocket events and push live notifications
  useWebSocket(
    useCallback((event: { type: string; data: any }) => {
      const typeMap: Record<string, string> = {
        "order:created": "New order committed",
        "order:matched": "Order matched in pool",
        "proof:generating": "ZK proof generation started",
        "proof:verified": "ZK proof verified",
        "settlement:confirmed": "Settlement confirmed on-chain",
        "vault:updated": "Vault balance updated",
      };
      const text = typeMap[event.type] || event.type;
      const notif: Notification = {
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: event.type.includes("verified") || event.type.includes("confirmed") ? "success" : "info",
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 20));
    }, []),
    ["order:created", "order:matched", "proof:generating", "proof:verified", "settlement:confirmed", "vault:updated"]
  );

  const walletAddr = walletAddress
    ? `${walletAddress.slice(0, 5)}...${walletAddress.slice(-3)}`
    : "Not Connected";

  const handleCopyWallet = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    navigate("/connect");
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-[68px] z-30 h-16 bg-[#0a0b14]/80 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between px-4 md:px-6">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
          <input
            type="text"
            placeholder="Search orders, proofs, transactions..."
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-cobalt/40 focus:ring-1 focus:ring-cobalt/20 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex px-1.5 py-0.5 rounded text-[10px] text-[#334155] bg-white/[0.04] border border-white/[0.06]">
            /
          </kbd>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Network indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <Wifi className="w-3.5 h-3.5 text-acid-green" />
          <span className="text-xs text-[#94a3b8]">Starknet Testnet</span>
        </div>

        {/* Wallet */}
        <button
          onClick={handleCopyWallet}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
        >
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-acid-green animate-pulse" : "bg-[#475569]"}`} />
          <span className="text-xs text-white" style={{ fontFamily: "var(--font-mono)" }}>
            {walletAddr}
          </span>
          {copied ? (
            <Check className="w-3 h-3 text-acid-green" />
          ) : (
            <Copy className="w-3 h-3 text-[#475569]" />
          )}
        </button>

        {/* Disconnect */}
        {isConnected && (
          <button
            onClick={handleDisconnect}
            title="Disconnect wallet"
            className="hidden sm:flex items-center p-2 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all group"
          >
            <LogOut className="w-4 h-4 text-[#64748b] group-hover:text-red-400 transition-colors" />
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
          >
            <Bell className="w-4 h-4 text-[#64748b]" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cobalt" />
            )}
          </button>

          <AnimatePresence>
            {showNotifs && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                className="absolute right-0 top-12 w-72 rounded-xl bg-[#1e293b] border border-white/[0.1] shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-sm text-white">Notifications</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-xs text-[#475569]">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                      >
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            n.type === "success"
                              ? "bg-acid-green shadow-[0_0_4px_rgba(74,222,128,0.5)]"
                              : "bg-cobalt"
                          }`}
                        />
                        <div>
                          <p className="text-xs text-white">{n.text}</p>
                          <p className="text-[10px] text-[#475569] mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-white/[0.06]">
                    <button
                      onClick={() => setNotifications([])}
                      className="text-xs text-cobalt hover:text-blue-400 transition-colors"
                    >
                      Clear all notifications
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
        >
          {darkMode ? (
            <Sun className="w-4 h-4 text-[#64748b]" />
          ) : (
            <Moon className="w-4 h-4 text-[#64748b]" />
          )}
        </button>
      </div>
    </header>
  );
}
