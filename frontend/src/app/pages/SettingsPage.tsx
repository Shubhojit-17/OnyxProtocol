import { useState, useEffect } from "react";
import {
  Sun,
  Moon,
  Shield,
  Fuel,
  Radio,
  Wallet,
  Bell,
  Save,
  Check,
  ChevronDown,
  Palette,
  Monitor,
  Terminal,
  RotateCcw,
} from "lucide-react";
import { motion } from "motion/react";
import { useSettings } from "../hooks/useSettings";

export default function SettingsPage() {
  const {
    settings,
    isDirty,
    updateSetting,
    updateNotification,
    saveSettings,
    revertSettings,
    saving,
  } = useSettings();
  const [saved, setSaved] = useState(false);

  // Revert unsaved changes when the user navigates away from this page
  useEffect(() => {
    return () => {
      // Cleanup runs when this component unmounts (user leaves settings page)
      // We call revert to restore the last-saved settings
      revertSettings();
    };
    // We intentionally only want this to run on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    try {
      await saveSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const {
    darkMode,
    designTheme,
    privacyMode,
    gasPreference,
    relayer,
    defaultPair,
    notifications,
  } = settings;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white mb-1">Settings</h1>
          <p className="text-sm text-[#64748b]">Configure your dashboard preferences and privacy defaults</p>
        </div>
        {isDirty && (
          <motion.span
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-amber-accent px-3 py-1.5 rounded-lg bg-amber-accent/10 border border-amber-accent/20"
          >
            Unsaved changes
          </motion.span>
        )}
      </div>

      {/* Design Theme Selection */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-3 mb-5">
          <Palette className="w-5 h-5 text-cobalt" />
          <div>
            <h4 className="text-white text-sm">Design Theme</h4>
            <p className="text-xs text-[#475569]">Choose your preferred visual style</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Institutional */}
          <button
            onClick={() => updateSetting("designTheme", "institutional")}
            className={`p-4 rounded-xl border text-left transition-all ${
              designTheme === "institutional"
                ? "bg-cobalt/5 border-cobalt/20 shadow-[0_0_15px_rgba(37,99,235,0.1)]"
                : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]"
            }`}
          >
            <Monitor className="w-5 h-5 text-cobalt mb-3" />
            <div className="text-sm text-white mb-1">Onyx Institutional</div>
            <p className="text-[10px] text-[#475569] leading-relaxed">
              Clean whitespace, slate grays, gold accents. Professional and refined.
            </p>
            <div className="flex gap-1.5 mt-3">
              <div className="w-4 h-4 rounded-full bg-[#0a0b14] border border-white/[0.1]" />
              <div className="w-4 h-4 rounded-full bg-cobalt" />
              <div className="w-4 h-4 rounded-full bg-amber-accent" />
              <div className="w-4 h-4 rounded-full bg-[#94a3b8]" />
            </div>
          </button>

          {/* Shadow Hacker */}
          <button
            onClick={() => updateSetting("designTheme", "shadow")}
            className={`p-4 rounded-xl border text-left transition-all ${
              designTheme === "shadow"
                ? "bg-acid-green/5 border-acid-green/20 shadow-[0_0_15px_rgba(74,222,128,0.1)]"
                : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]"
            }`}
          >
            <Terminal className="w-5 h-5 text-acid-green mb-3" />
            <div className="text-sm text-white mb-1">Shadow Hacker</div>
            <p className="text-[10px] text-[#475569] leading-relaxed">
              True black, neon green mono-type. Terminal aesthetic.
            </p>
            <div className="flex gap-1.5 mt-3">
              <div className="w-4 h-4 rounded-full bg-black border border-white/[0.1]" />
              <div className="w-4 h-4 rounded-full bg-acid-green" />
              <div className="w-4 h-4 rounded-full bg-[#22c55e]" />
              <div className="w-4 h-4 rounded-full bg-[#0f172a]" />
            </div>
          </button>
        </div>
      </div>

      {/* Theme */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {darkMode ? <Moon className="w-5 h-5 text-cobalt" /> : <Sun className="w-5 h-5 text-amber-accent" />}
            <div>
              <h4 className="text-white text-sm">Theme</h4>
              <p className="text-xs text-[#475569]">{darkMode ? "Dark mode enabled" : "Light mode enabled"}</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting("darkMode", !darkMode)}
            className={`relative w-12 h-6 rounded-full transition-colors ${darkMode ? "bg-cobalt" : "bg-[#334155]"}`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${
                darkMode ? "left-6" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Privacy Mode */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-acid-green" />
            <div>
              <h4 className="text-white text-sm">Default Privacy Mode</h4>
              <p className="text-xs text-[#475569]">Blur balances and sensitive data by default</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting("privacyMode", !privacyMode)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              privacyMode ? "bg-acid-green" : "bg-[#334155]"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${
                privacyMode ? "left-6" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Gas Preference */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-3 mb-4">
          <Fuel className="w-5 h-5 text-amber-accent" />
          <div>
            <h4 className="text-white text-sm">Gas Preference</h4>
            <p className="text-xs text-[#475569]">Set your preferred gas speed for transactions</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { level: "Low", desc: "~30s", cost: "0.001 STRK" },
            { level: "Standard", desc: "~15s", cost: "0.003 STRK" },
            { level: "Fast", desc: "~5s", cost: "0.008 STRK" },
          ].map((opt) => (
            <button
              key={opt.level}
              onClick={() => updateSetting("gasPreference", opt.level)}
              className={`py-3 px-4 rounded-xl text-left transition-all ${
                gasPreference === opt.level
                  ? "bg-cobalt/10 text-cobalt border border-cobalt/20"
                  : "bg-white/[0.02] text-[#64748b] border border-white/[0.06] hover:text-white"
              }`}
            >
              <div className="text-sm mb-0.5">{opt.level}</div>
              <div className="text-[10px] opacity-60">{opt.desc} &middot; {opt.cost}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Relayer */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-cobalt" />
            <div>
              <h4 className="text-white text-sm">Privacy Relayer</h4>
              <p className="text-xs text-[#475569]">Route transactions through privacy relayer to obfuscate IP</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting("relayer", !relayer)}
            className={`relative w-12 h-6 rounded-full transition-colors ${relayer ? "bg-cobalt" : "bg-[#334155]"}`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${
                relayer ? "left-6" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Default Asset Pair */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="w-5 h-5 text-cobalt" />
          <div>
            <h4 className="text-white text-sm">Default Asset Pair</h4>
            <p className="text-xs text-[#475569]">Set your preferred trading pair</p>
          </div>
        </div>
        <div className="relative max-w-xs">
          <select
            value={defaultPair}
            onChange={(e) => updateSetting("defaultPair", e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-cobalt/40"
          >
            <option value="STRK / oETH">STRK / oETH</option>
            <option value="STRK / oSEP">STRK / oSEP</option>
            <option value="oETH / oSEP">oETH / oSEP</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569] pointer-events-none" />
        </div>
      </div>

      {/* Notifications */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-cobalt" />
          <div>
            <h4 className="text-white text-sm">Notification Preferences</h4>
            <p className="text-xs text-[#475569]">Choose which events trigger notifications</p>
          </div>
        </div>
        <div className="space-y-4">
          {([
            {
              key: "proofVerified" as const,
              label: "Proof Verified",
              desc: "When a ZK proof is verified for your trade",
            },
            {
              key: "orderMatched" as const,
              label: "Order Matched",
              desc: "When your hidden order finds a match",
            },
            {
              key: "vaultActivity" as const,
              label: "Vault Activity",
              desc: "Deposits, withdrawals, shield/unshield events",
            },
            {
              key: "systemUpdates" as const,
              label: "System Updates",
              desc: "Protocol upgrades and maintenance notices",
            },
          ]).map((notif) => (
            <div key={notif.key} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm text-white">{notif.label}</div>
                <div className="text-xs text-[#475569]">{notif.desc}</div>
              </div>
              <button
                onClick={() => updateNotification(notif.key, !notifications[notif.key])}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  notifications[notif.key] ? "bg-cobalt" : "bg-[#334155]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${
                    notifications[notif.key] ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {isDirty && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={revertSettings}
            className="px-6 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm bg-white/[0.02] text-[#64748b] border border-white/[0.06] hover:text-white hover:border-white/[0.1]"
          >
            <RotateCcw className="w-4 h-4" />
            Discard Changes
          </motion.button>
        )}
        <motion.button
          onClick={handleSave}
          whileTap={{ scale: 0.98 }}
          disabled={saving}
          className={`flex-1 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm ${
            saved
              ? "bg-acid-green/10 text-acid-green border border-acid-green/20"
              : isDirty
                ? "bg-cobalt text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                : "bg-cobalt/50 text-white/50 cursor-default"
          }`}
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              Settings Saved
            </>
          ) : saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
