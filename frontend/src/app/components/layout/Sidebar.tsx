import { useState } from "react";
import { NavLink } from "react-router";
import {
  LayoutDashboard,
  ArrowLeftRight,
  CloudFog,
  Zap,
  Vault,
  BarChart3,
  History,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { to: "/app", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/app/trade", icon: ArrowLeftRight, label: "Trade" },
  { to: "/app/dark-pool", icon: CloudFog, label: "Dark Pool" },
  { to: "/app/execution", icon: Zap, label: "Execution" },
  { to: "/app/vault", icon: Vault, label: "Vault" },
  { to: "/app/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/app/history", icon: History, label: "History" },
  { to: "/app/compliance", icon: ShieldCheck, label: "Compliance" },
  { to: "/app/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden bg-[#0d0e18]/95 backdrop-blur-xl border-t border-white/[0.06]">
        <div className="flex w-full justify-around py-2">
          {navItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                  isActive ? "text-cobalt" : "text-[#64748b] hover:text-white/70"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop sidebar */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`hidden md:flex fixed left-0 top-0 h-screen z-40 flex-col bg-[#0d0e18]/95 backdrop-blur-xl border-r border-white/[0.06] transition-all duration-300 ease-in-out ${
          expanded ? "w-56" : "w-[68px]"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cobalt to-blue-400 flex items-center justify-center shrink-0">
              <span className="text-white text-sm tracking-wider" style={{ fontFamily: "var(--font-mono)" }}>O</span>
            </div>
            <span
              className={`text-white tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300 ${
                expanded ? "opacity-100 w-auto" : "opacity-0 w-0"
              }`}
            >
              ONYX
            </span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-cobalt/10 text-cobalt shadow-[inset_0_0_0_1px_rgba(37,99,235,0.2),0_0_12px_rgba(37,99,235,0.1)]"
                    : "text-[#64748b] hover:text-white hover:bg-white/[0.04]"
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span
                className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  expanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Collapse indicator */}
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-[#475569] hover:text-white/70 transition-colors w-full px-2"
          >
            {expanded ? (
              <ChevronLeft className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" />
            )}
            <span
              className={`text-xs whitespace-nowrap overflow-hidden transition-all duration-300 ${
                expanded ? "opacity-100 w-auto" : "opacity-0 w-0"
              }`}
            >
              Collapse
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
