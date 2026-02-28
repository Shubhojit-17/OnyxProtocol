import { Outlet, useNavigate } from "react-router";
import { useEffect } from "react";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import { motion } from "motion/react";
import { useWallet } from "../../hooks/useWallet";

export default function DashboardLayout() {
  const { isConnected, verified } = useWallet();
  const navigate = useNavigate();

  // Redirect to connect page if wallet is not connected (after verification completes)
  useEffect(() => {
    if (verified && !isConnected) {
      navigate("/connect", { replace: true });
    }
  }, [verified, isConnected, navigate]);

  // Show loading while checking wallet connection on mount
  if (!verified) {
    return (
      <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Reconnecting wallet…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />
      <TopHeader />
      <main className="md:ml-[68px] pt-16 pb-20 md:pb-0 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 md:p-6 lg:p-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
