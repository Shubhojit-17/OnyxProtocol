import { Link } from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Lock,
  Shield,
  ArrowRight,
  ChevronRight,
  Vault,
  Eye,
  Users,
  ShieldCheck,
  FileCheck,
  Ban,
  ClipboardCheck,
  Github,
  ExternalLink,
  Send,
  Layers,
  Target,
} from "lucide-react";
import { motion, useInView } from "motion/react";
import { darkPoolApi } from "../services/api";
import { useApi } from "../hooks/useApi";

/* ── data ────────────────────────────────────────────── */
const features = [
  {
    icon: Lock,
    title: "Atomic Privacy",
    description:
      "Order details are committed as hashed commitments on-chain. No public orderbook exposure, no front-running, no data leaks.",
    gradient: "from-blue-500/20 to-indigo-600/10",
  },
  {
    icon: Layers,
    title: "Institutional STRK/ETH Liquidity",
    description:
      "Deep liquidity pools for Starknet-native assets. Designed for large-block trades without market impact.",
    gradient: "from-amber-500/20 to-orange-600/10",
  },
  {
    icon: Target,
    title: "Zero-Slippage Matching",
    description:
      "Dark pool matching engine executes at consensus mid-price. Zero slippage, zero information leakage, zero MEV extraction.",
    gradient: "from-emerald-500/20 to-green-600/10",
  },
];

const steps = [
  {
    icon: Vault,
    title: "Deposit into Vault",
    description: "Shield your STRK & ETH assets in a non-custodial vault with cryptographic privacy guarantees.",
  },
  {
    icon: Eye,
    title: "Create Hidden Order",
    description: "Submit encrypted limit orders that remain invisible until matched and settled.",
  },
  {
    icon: Users,
    title: "Private Matching",
    description: "Orders match within the dark pool against aggregated hidden liquidity.",
  },
  {
    icon: ShieldCheck,
    title: "ZK Proof Settlement",
    description: "Settlement is finalized on-chain with a verifiable ZK-STARK proof. No trust required.",
  },
];

const securityFeatures = [
  {
    icon: Vault,
    title: "Non-custodial vault design",
    description: "Your keys, your funds. Assets are secured by smart contracts on Starknet.",
  },
  {
    icon: FileCheck,
    title: "Proof-based settlement",
    description: "Every trade generates a cryptographic proof that can be independently verified.",
  },
  {
    icon: Ban,
    title: "Replay attack prevention",
    description: "Nullifier-based architecture prevents double-spend and replay attacks.",
  },
  {
    icon: ClipboardCheck,
    title: "Auditable verification logs",
    description: "Compliance-ready audit trails without compromising trader privacy.",
  },
];

const roadmap = [
  {
    phase: "Phase 1",
    title: "Private Orders",
    status: "Live",
    items: ["Encrypted order commitments", "Vault deposits", "Basic matching engine"],
  },
  {
    phase: "Phase 2",
    title: "Dark Pool Matching",
    status: "In Progress",
    items: ["Multi-asset dark pool", "Liquidity fog visualization", "Advanced order types"],
  },
  {
    phase: "Phase 3",
    title: "Compliance Mode",
    status: "Upcoming",
    items: ["Selective disclosure", "Institutional viewing keys", "Regulatory reporting"],
  },
  {
    phase: "Phase 4",
    title: "Institutional API",
    status: "Planned",
    items: ["REST & WebSocket APIs", "Solver network integration", "Cross-chain liquidity"],
  },
];

const partners = ["Starknet Foundation", "StarkWare", "OpenZeppelin", "Xverse"];

/* ── Interactive sphere ──────────────────────────────── */
function InteractiveSphere() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { data: sphereStats } = useApi(() => darkPoolApi.getStats(), []);
  const hiddenOrders = sphereStats?.hiddenOrderCount ?? 0;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMousePos({ x, y });
  }, []);

  const fragments = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    angle: (i / 20) * Math.PI * 2,
    radius: 80 + Math.random() * 40,
    size: 1.5 + Math.random() * 2,
    speed: 15 + Math.random() * 25,
    delay: Math.random() * -20,
  }));

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-72 h-72 md:w-96 md:h-96 cursor-crosshair"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at ${50 + mousePos.x * 15}% ${50 + mousePos.y * 15}%, rgba(37, 99, 235, 0.15), transparent 70%)`,
          transition: "background 0.3s ease-out",
        }}
      />
      <div
        className="absolute inset-0 rounded-full border border-cobalt/15"
        style={{
          transform: `translate(${mousePos.x * 4}px, ${mousePos.y * 4}px)`,
          transition: "transform 0.5s ease-out",
          animation: "glowPulse 4s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-4 rounded-full border border-white/[0.05]"
        style={{
          background: `radial-gradient(circle at ${50 - mousePos.x * 20}% ${50 - mousePos.y * 20}%, rgba(37, 99, 235, 0.08), transparent 60%)`,
          transform: `translate(${mousePos.x * -3}px, ${mousePos.y * -3}px)`,
          transition: "all 0.4s ease-out",
        }}
      />
      <div
        className="absolute inset-8 rounded-full border border-white/[0.04]"
        style={{
          background: `radial-gradient(circle at ${50 + mousePos.x * 25}% ${50 + mousePos.y * 25}%, rgba(99, 102, 241, 0.06), transparent 50%)`,
          transform: `translate(${mousePos.x * 2}px, ${mousePos.y * 2}px)`,
          transition: "all 0.5s ease-out",
        }}
      />
      <div className="absolute inset-14 rounded-full bg-[#0d0e18] border border-white/[0.06] flex items-center justify-center backdrop-blur-sm">
        <div className="text-center">
          <div className="text-[10px] text-cobalt/60 mb-1 tracking-[0.3em]" style={{ fontFamily: "var(--font-mono)" }}>
            LIQUIDITY FOG
          </div>
          <div className="text-3xl text-white tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
            {hiddenOrders}
          </div>
          <div className="text-[10px] text-[#475569] mt-0.5">hidden orders</div>
        </div>
      </div>
      {fragments.map((f) => (
        <div
          key={f.id}
          className="absolute inset-0"
          style={{
            animation: `spin ${f.speed}s linear infinite`,
            animationDelay: `${f.delay}s`,
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: f.size,
              height: f.size,
              top: `calc(50% - ${f.radius}px)`,
              left: "50%",
              background: f.id % 3 === 0 ? "#4ade80" : "#2563eb",
              boxShadow: `0 0 ${f.size * 3}px ${f.id % 3 === 0 ? "rgba(74,222,128,0.6)" : "rgba(37,99,235,0.6)"}`,
              transform: `translate(${mousePos.x * (f.id % 5) * 2}px, ${mousePos.y * (f.id % 5) * 2}px)`,
              transition: "transform 0.6s ease-out",
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ── Fog of War comparison ───────────────────────────── */
function FogOfWarComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const publicOrders = [
    { price: "$0.4285", size: "2,400 STRK", type: "ask" },
    { price: "$0.4270", size: "1,800 STRK", type: "ask" },
    { price: "$0.4250", size: "5,200 STRK", type: "ask" },
    { price: "$0.4230", size: "900 STRK", type: "bid" },
    { price: "$0.4210", size: "3,100 STRK", type: "bid" },
    { price: "$0.4200", size: "4,700 STRK", type: "bid" },
  ];

  return (
    <div ref={ref} className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="p-6 rounded-2xl bg-white/[0.02] border border-red-500/10"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-xs text-red-400/80 tracking-wider">TRADITIONAL ORDER BOOK</span>
        </div>
        <div className="space-y-1.5">
          {publicOrders.map((order, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]">
              <span className="text-xs text-white" style={{ fontFamily: "var(--font-mono)" }}>{order.price}</span>
              <span className="text-xs text-white" style={{ fontFamily: "var(--font-mono)" }}>{order.size}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${order.type === "ask" ? "text-red-400 bg-red-500/10" : "text-acid-green bg-acid-green/10"}`}>
                {order.type.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-red-400/60">
          <Eye className="w-3 h-3" />
          <span>Fully exposed to MEV bots & front-runners</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-cobalt/5 to-transparent border border-cobalt/15 relative overflow-hidden"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-cobalt animate-pulse" />
          <span className="text-xs text-cobalt/80 tracking-wider">ONYX DARK POOL</span>
        </div>
        <div className="grid grid-cols-8 grid-rows-6 gap-1 mb-3">
          {Array.from({ length: 48 }).map((_, i) => {
            const centerDist = Math.abs(i % 8 - 4) + Math.abs(Math.floor(i / 8) - 3);
            const intensity = Math.max(0, 1 - centerDist / 6) + Math.random() * 0.2;
            return (
              <div
                key={i}
                className="aspect-square rounded-sm"
                style={{
                  backgroundColor: `rgba(37, 99, 235, ${Math.min(0.8, intensity * 0.5)})`,
                  animation: `float ${3 + Math.random() * 2}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * -5}s`,
                }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-cobalt/60 mb-3">
          <span>Low Density</span>
          <span>High Density</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-acid-green/80">
          <Shield className="w-3 h-3" />
          <span>Individual orders invisible. Privacy preserved.</span>
        </div>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-transparent via-transparent to-cobalt/[0.03]" />
      </motion.div>
    </div>
  );
}

function AnimatedStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl text-white mb-1" style={{ fontFamily: "var(--font-mono)" }}>{value}</div>
      <div className="text-xs text-[#475569]">{label}</div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────── */
export default function LandingPage() {
  const { data: landingStats } = useApi(() => darkPoolApi.getStats(), []);

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-[#0a0b14]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cobalt to-blue-400 flex items-center justify-center">
                <span className="text-white text-sm tracking-wider" style={{ fontFamily: "var(--font-mono)" }}>O</span>
              </div>
              <span className="text-white tracking-[0.2em]">ONYX</span>
            </Link>
            <div className="hidden lg:flex items-center gap-6">
              {["Product", "How It Works", "Security", "Docs", "Pricing", "Community"].map((item) => (
                <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`} className="text-sm text-[#94a3b8] hover:text-white transition-colors">{item}</a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="#docs" className="hidden sm:inline-flex px-4 py-2 text-sm text-[#94a3b8] border border-white/[0.1] rounded-xl hover:border-white/20 hover:text-white transition-all">Docs</a>
            <Link to="/connect" className="px-4 py-2 text-sm bg-cobalt text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]">Launch App</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-16 md:pt-44 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-cobalt/[0.05] blur-[120px]" />
          <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-blue-900/20 blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-900/10 blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm text-[#94a3b8]">
              <div className="w-2 h-2 rounded-full bg-acid-green animate-pulse" />
              Live on Starknet Testnet
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white max-w-5xl mx-auto mb-6 tracking-tight" style={{ lineHeight: 1.1 }}>
              Trade the Shadows.{" "}
              <span className="bg-gradient-to-r from-cobalt via-blue-400 to-indigo-400 bg-clip-text text-transparent">Secure the Light.</span>
            </h1>
            <p className="text-lg md:text-xl text-[#94a3b8] max-w-2xl mx-auto mb-10">
              Onyx Protocol is a ZK-powered dark pool on Starknet for private liquidity. Place encrypted orders, avoid MEV, and execute privately with zero-knowledge proofs.
            </p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <Link to="/connect" className="group px-7 py-3.5 bg-cobalt text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] flex items-center gap-2">
                Launch App
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#docs" className="px-7 py-3.5 text-[#94a3b8] border border-white/[0.1] rounded-xl hover:border-white/20 hover:text-white transition-all">Read Docs</a>
            </div>
            <div className="flex items-center justify-center gap-8 md:gap-12 mt-4">
              <AnimatedStat value={landingStats?.volume24h || "—"} label="Total Volume" />
              <div className="w-px h-8 bg-white/[0.06]" />
              <AnimatedStat value={landingStats?.proofVelocity || "—"} label="Avg Proof Time" />
              <div className="w-px h-8 bg-white/[0.06] hidden sm:block" />
              <div className="hidden sm:block">
                <AnimatedStat value={String(landingStats?.hiddenOrderCount ?? "—")} label="Anonymity Set" />
              </div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.3 }} className="mt-16 flex justify-center">
            <InteractiveSphere />
          </motion.div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="py-12 border-y border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-[#475569] mb-8 tracking-widest uppercase">Backed by leading infrastructure</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {partners.map((partner) => (
              <div key={partner} className="flex items-center gap-2 text-[#475569] hover:text-[#64748b] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <span className="text-xs">{partner[0]}</span>
                </div>
                <span className="text-sm">{partner}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOG OF WAR COMPARISON */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-white mb-4">See the Difference</h2>
            <p className="text-[#94a3b8] max-w-xl mx-auto">Traditional order books expose everything. Onyx hides individual orders while preserving liquidity signals.</p>
          </div>
          <FogOfWarComparison />
        </div>
      </section>

      {/* FEATURES */}
      <section id="product" className="py-20 md:py-28 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-white mb-4">Private Trading Infrastructure</h2>
            <p className="text-[#94a3b8] max-w-xl mx-auto">Built from the ground up for institutional-grade privacy on Starknet.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-cobalt/20 hover:bg-white/[0.04] transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-cobalt/10 border border-cobalt/20 flex items-center justify-center mb-5 group-hover:shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-shadow">
                    <feature.icon className="w-5 h-5 text-cobalt" />
                  </div>
                  <h3 className="text-white mb-3">{feature.title}</h3>
                  <p className="text-sm text-[#94a3b8] leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-white mb-4">How It Works</h2>
            <p className="text-[#94a3b8] max-w-xl mx-auto">Four steps from deposit to verified private settlement.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div key={step.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] group hover:border-cobalt/15 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-cobalt/10 flex items-center justify-center text-sm text-cobalt" style={{ fontFamily: "var(--font-mono)" }}>{i + 1}</div>
                  {i < 3 && <ChevronRight className="w-4 h-4 text-[#334155] absolute -right-5 top-1/2 -translate-y-1/2 hidden lg:block" />}
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4 group-hover:bg-cobalt/10 transition-colors">
                  <step.icon className="w-5 h-5 text-[#94a3b8] group-hover:text-cobalt transition-colors" />
                </div>
                <h4 className="text-white mb-2">{step.title}</h4>
                <p className="text-sm text-[#64748b] leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="py-20 md:py-28 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-white mb-4">Security Architecture</h2>
            <p className="text-[#94a3b8] max-w-xl mx-auto">Defense in depth with zero-knowledge cryptography at every layer.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {securityFeatures.map((sec, i) => (
              <motion.div key={sec.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex gap-4 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-acid-green/10 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-acid-green/10 border border-acid-green/20 flex items-center justify-center shrink-0 group-hover:shadow-[0_0_15px_rgba(74,222,128,0.15)] transition-shadow">
                  <sec.icon className="w-5 h-5 text-acid-green" />
                </div>
                <div>
                  <h4 className="text-white mb-1">{sec.title}</h4>
                  <p className="text-sm text-[#64748b] leading-relaxed">{sec.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT PREVIEW */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-white mb-4">Built for Professionals</h2>
            <p className="text-[#94a3b8] max-w-xl mx-auto">Institutional-grade dark pool interface with real-time proof verification.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-5 rounded-2xl bg-[#111827] border border-white/[0.06] hover:border-cobalt/15 transition-all">
              <div className="text-xs text-[#475569] mb-3 tracking-wider">ORDER CREATION</div>
              <div className="space-y-3">
                {[["Type", "BUY"], ["Asset", "STRK / ETH"], ["Amount", "2,500 STRK"], ["Price", "$0.4250"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-[#64748b]">{k}</span>
                    <span className="text-white" style={{ fontFamily: "var(--font-mono)" }}>{v}</span>
                  </div>
                ))}
                <div className="mt-4 py-2 rounded-lg bg-cobalt/10 text-center text-sm text-cobalt border border-cobalt/20">Generate Commitment</div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="p-5 rounded-2xl bg-[#111827] border border-white/[0.06] hover:border-cobalt/15 transition-all">
              <div className="text-xs text-[#475569] mb-3 tracking-wider">PROOF TIMELINE</div>
              <div className="space-y-4">
                {["Commitment Created", "Match Found", "Proving", "Proof Verified", "Settled"].map((step, i) => (
                  <div key={step} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${i < 4 ? "bg-acid-green shadow-[0_0_6px_rgba(74,222,128,0.5)]" : "bg-cobalt animate-pulse"}`} />
                    <span className={`text-sm ${i < 4 ? "text-white" : "text-[#64748b]"}`}>{step}</span>
                    {i < 4 && <span className="ml-auto text-xs text-acid-green" style={{ fontFamily: "var(--font-mono)" }}>{"\u2713"}</span>}
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="p-5 rounded-2xl bg-[#111827] border border-white/[0.06] hover:border-cobalt/15 transition-all">
              <div className="text-xs text-[#475569] mb-3 tracking-wider">LIQUIDITY FOG</div>
              <div className="grid grid-cols-8 grid-rows-6 gap-1">
                {Array.from({ length: 48 }).map((_, i) => {
                  const cx = Math.abs(i % 8 - 4);
                  const cy = Math.abs(Math.floor(i / 8) - 3);
                  const dist = cx + cy;
                  const intensity = Math.max(0, 1 - dist / 6) + Math.random() * 0.15;
                  return <div key={i} className="aspect-square rounded-sm" style={{ backgroundColor: `rgba(37, 99, 235, ${Math.min(0.7, intensity * 0.5)})` }} />;
                })}
              </div>
              <div className="mt-3 flex justify-between text-xs text-[#475569]">
                <span>Low Density</span>
                <span>High Density</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="py-20 md:py-28 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-white mb-4">Roadmap</h2>
            <p className="text-[#94a3b8] max-w-xl mx-auto">Building the future of private trading infrastructure.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {roadmap.map((phase, i) => (
              <motion.div key={phase.phase} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-cobalt" style={{ fontFamily: "var(--font-mono)" }}>{phase.phase}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${phase.status === "Live" ? "bg-acid-green/10 text-acid-green" : phase.status === "In Progress" ? "bg-cobalt/10 text-cobalt" : "bg-white/[0.04] text-[#475569]"}`}>{phase.status}</span>
                </div>
                <h4 className="text-white mb-3">{phase.title}</h4>
                <ul className="space-y-2">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-[#64748b]">
                      <div className="w-1 h-1 rounded-full bg-[#334155]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-10 md:p-16 rounded-3xl bg-gradient-to-br from-cobalt/10 to-transparent border border-cobalt/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cobalt/5 to-transparent" />
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, rgba(37,99,235,0.3) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl text-white mb-4">Ready to execute privately?</h2>
              <p className="text-[#94a3b8] mb-8 max-w-md mx-auto">Join the institutional-grade dark pool on Starknet. Privacy by default.</p>
              <Link to="/connect" className="inline-flex items-center gap-2 px-8 py-3.5 bg-cobalt text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_rgba(37,99,235,0.6)]">
                Launch App
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cobalt to-blue-400 flex items-center justify-center">
                  <span className="text-white text-xs" style={{ fontFamily: "var(--font-mono)" }}>O</span>
                </div>
                <span className="text-white tracking-[0.2em] text-sm">ONYX</span>
              </div>
              <p className="text-sm text-[#475569] mb-4">ZK Dark Pool Protocol on Starknet for private liquidity.</p>
              <div className="flex items-center gap-3">
                <a href="#" className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors"><ExternalLink className="w-4 h-4 text-[#64748b]" /></a>
                <a href="#" className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors"><Send className="w-4 h-4 text-[#64748b]" /></a>
                <a href="#" className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors"><Github className="w-4 h-4 text-[#64748b]" /></a>
              </div>
            </div>
            <div>
              <h4 className="text-white text-sm mb-4">Protocol</h4>
              <ul className="space-y-2">{["Documentation", "Whitepaper", "GitHub", "Audit Reports"].map((link) => (<li key={link}><a href="#" className="text-sm text-[#475569] hover:text-[#94a3b8] transition-colors">{link}</a></li>))}</ul>
            </div>
            <div>
              <h4 className="text-white text-sm mb-4">Community</h4>
              <ul className="space-y-2">{["Twitter / X", "Telegram", "Discord", "Forum"].map((link) => (<li key={link}><a href="#" className="text-sm text-[#475569] hover:text-[#94a3b8] transition-colors">{link}</a></li>))}</ul>
            </div>
            <div>
              <h4 className="text-white text-sm mb-4">Legal</h4>
              <ul className="space-y-2">{["Terms of Service", "Privacy Policy", "Contact", "Bug Bounty"].map((link) => (<li key={link}><a href="#" className="text-sm text-[#475569] hover:text-[#94a3b8] transition-colors">{link}</a></li>))}</ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#334155]">&copy; 2026 Onyx Protocol. Built on Starknet.</p>
            <p className="text-xs text-[#334155]">contact@onyxprotocol.com</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
