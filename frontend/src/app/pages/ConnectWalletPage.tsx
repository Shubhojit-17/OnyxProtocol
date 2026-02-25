import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Shield, Wallet, ArrowRight, Lock, Radio, CheckCircle2, Cpu, LogOut, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useWallet } from "../hooks/useWallet";

const proofSteps = [
  "Initializing Starknet handshake...",
  "Verifying wallet signature...",
  "Generating session commitment...",
  "Establishing privacy relay...",
  "Connection secured via STARK proof.",
];

export default function ConnectWalletPage() {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentProofStep, setCurrentProofStep] = useState(0);
  const [connectError, setConnectError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { connectStarknet, disconnect, isConnected, isConnecting: walletConnecting, walletAddress, walletName } = useWallet();

  /* Always start fresh when visiting the connect page */
  useEffect(() => {
    disconnect();
    setConnected(false);
    setConnecting(false);
    setConnectError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = () => {
    disconnect();
    setConnected(false);
    setConnecting(false);
    setConnectError(null);
  };

  const handleConnect = async () => {
    setConnectError(null);

    try {
      /* Open Starknet wallet selector (ArgentX / Braavos) */
      await connectStarknet();
      /* Connection confirmed — now play the secure-handshake animation */
      setConnecting(true);
      setScanProgress(0);
      setCurrentProofStep(0);
    } catch (err: any) {
      setConnectError(err.message || "Connection failed");
    }
  };

  // Animate connection process
  useEffect(() => {
    if (!connecting) return;

    const progressInterval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    const stepInterval = setInterval(() => {
      setCurrentProofStep((prev) => {
        if (prev >= proofSteps.length - 1) {
          clearInterval(stepInterval);
          setTimeout(() => {
            setConnected(true);
            setConnecting(false);
          }, 400);
          return prev;
        }
        return prev + 1;
      });
    }, 350);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, [connecting]);

  return (
    <div
      className="min-h-screen bg-[#0a0b14] text-white flex items-center justify-center p-4 relative overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-cobalt/[0.04] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full bg-indigo-900/10 blur-[100px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Back to landing */}
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-[#475569] hover:text-white transition-colors z-10"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cobalt to-blue-400 flex items-center justify-center">
          <span className="text-white text-xs" style={{ fontFamily: "var(--font-mono)" }}>
            O
          </span>
        </div>
        <span className="tracking-[0.2em]">ONYX</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-3xl bg-[#111827]/80 backdrop-blur-xl border border-white/[0.08] p-8 shadow-2xl relative overflow-hidden">
          {/* Shielding animation overlay */}
          <AnimatePresence>
            {connecting && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#111827]/95 backdrop-blur-sm rounded-3xl p-8"
              >
                {/* Geometric shield assembly */}
                <div className="relative w-24 h-24 mb-6">
                  {/* Outer hexagon ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0"
                  >
                    {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                      <motion.div
                        key={angle}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.15 }}
                        className="absolute w-3 h-3 border border-cobalt/40 rotate-45"
                        style={{
                          top: `${50 - 42 * Math.cos((angle * Math.PI) / 180)}%`,
                          left: `${50 + 42 * Math.sin((angle * Math.PI) / 180)}%`,
                          transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                          backgroundColor: `rgba(37, 99, 235, ${0.1 + (scanProgress / 100) * 0.3})`,
                        }}
                      />
                    ))}
                  </motion.div>

                  {/* Inner shield icon */}
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Shield className="w-10 h-10 text-cobalt" style={{ filter: "drop-shadow(0 0 12px rgba(37,99,235,0.5))" }} />
                  </motion.div>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-xs mb-4">
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-cobalt to-blue-400"
                      style={{ width: `${scanProgress}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </div>

                {/* Proof step text */}
                <div className="text-center h-12">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentProofStep}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="text-xs text-cobalt"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {proofSteps[currentProofStep]}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Background scrolling crypto text */}
                <div className="absolute inset-0 overflow-hidden opacity-[0.04] pointer-events-none">
                  <div
                    className="text-[10px] text-cobalt whitespace-pre-wrap break-all leading-relaxed"
                    style={{
                      fontFamily: "var(--font-mono)",
                      animation: "proofScroll 20s linear infinite",
                    }}
                  >
                    {Array.from({ length: 40 })
                      .map(() => "FRI-domain expansion... Generating witness... Polynomial commitment finalized... STARK proof assembled... Verifying Merkle path... Hash chain validated... ")
                      .join("\n")}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-cobalt/10 border border-cobalt/20 flex items-center justify-center mx-auto mb-5">
              <Shield className="w-6 h-6 text-cobalt" />
            </div>
            <h2 className="text-2xl text-white mb-2">Secure Enclave</h2>
            <p className="text-sm text-[#64748b]">Connect your wallet to access the Onyx private trading layer.</p>
          </div>

          {/* Wallet Options */}
          <div className="space-y-3 mb-6">
            {/* Starknet wallet button (ArgentX / Braavos) */}
            <button
              onClick={handleConnect}
              disabled={walletConnecting || connecting || connected || isConnected}
              className="group w-full relative flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-cobalt/20 hover:bg-white/[0.04] transition-all duration-300 overflow-hidden disabled:opacity-50"
            >
              <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                <div
                  className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cobalt/40 to-transparent"
                  style={{ animation: "scanLine 2s linear infinite" }}
                />
              </div>

              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "rgba(37,99,235,0.08)",
                  border: "1px solid rgba(37,99,235,0.2)",
                }}
              >
                <Shield className="w-5 h-5 text-cobalt" />
              </div>
              <div className="text-left flex-1">
                <div className="text-white text-sm">
                  {walletConnecting ? "Waiting for wallet…" : "Connect Starknet Wallet"}
                </div>
                <div className="text-xs text-[#475569]">
                  {walletConnecting
                    ? "Confirm in your wallet"
                    : "Argent X · Braavos · WebWallet"}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#334155] group-hover:text-cobalt transition-colors" />
            </button>

            {/* Error message */}
            {connectError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{connectError}</p>
              </div>
            )}
          </div>

          {/* Privacy Notice */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] mb-6">
            <div className="flex gap-3">
              <Radio className="w-4 h-4 text-acid-green shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Your IP is obfuscated via <span className="text-acid-green">Privacy Relayer</span>. Network: <span className="text-cobalt">Starknet Sepolia</span>. Orders encrypted with Pedersen commitments. Settlement verified by ZK-STARK proofs.
                </p>
              </div>
            </div>
          </div>

          {/* Connected state (either just connected or was already connected) */}
          <AnimatePresence>
            {(connected || isConnected) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl bg-acid-green/5 border border-acid-green/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-acid-green" />
                    <div>
                      <span className="text-sm text-acid-green block">
                        {walletName ? `${walletName} connected` : "Wallet connected"}
                      </span>
                      {walletAddress && (
                        <span className="text-[10px] text-acid-green/60" style={{ fontFamily: "var(--font-mono)" }}>
                          {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/5 transition-all group"
                  >
                    <LogOut className="w-3.5 h-3.5 text-[#64748b] group-hover:text-red-400 transition-colors" />
                    <span className="text-xs text-[#64748b] group-hover:text-red-400 transition-colors">Disconnect</span>
                  </button>
                </div>
                <button
                  onClick={() => navigate("/app")}
                  className="w-full py-3 bg-cobalt text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center justify-center gap-2"
                >
                  Continue to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!connected && !isConnected && !connecting && (
            <p className="w-full py-3 text-sm text-[#475569] text-center">
              Connect your wallet to access the dashboard
            </p>
          )}
        </div>

        {/* Bottom text */}
        <p className="text-center text-xs text-[#334155] mt-6">
          By connecting, you agree to the{" "}
          <a href="#" className="text-[#475569] hover:text-cobalt transition-colors">
            Terms of Service
          </a>
        </p>
      </motion.div>
    </div>
  );
}
