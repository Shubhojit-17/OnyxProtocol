import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import { motion } from "motion/react";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
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
