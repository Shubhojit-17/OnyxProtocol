import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useWallet } from "./useWallet";
import { userApi } from "../services/api";

/* ────────── types ────────── */
export interface AppSettings {
  darkMode: boolean;
  designTheme: "institutional" | "shadow";
  privacyMode: boolean;
  gasPreference: string;
  relayer: boolean;
  defaultPair: string;
  notifications: {
    proofVerified: boolean;
    orderMatched: boolean;
    vaultActivity: boolean;
    systemUpdates: boolean;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  designTheme: "institutional",
  privacyMode: true,
  gasPreference: "Standard",
  relayer: true,
  defaultPair: "STRK / oETH",
  notifications: {
    proofVerified: true,
    orderMatched: true,
    vaultActivity: true,
    systemUpdates: false,
  },
};

interface SettingsContextType {
  /** The currently-active (previewed) settings */
  settings: AppSettings;
  /** The last-saved settings (reverts here on discard) */
  savedSettings: AppSettings;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Update a single setting (applies immediately as preview) */
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  /** Update a notification preference */
  updateNotification: (key: keyof AppSettings["notifications"], value: boolean) => void;
  /** Persist all current settings to backend + localStorage */
  saveSettings: () => Promise<void>;
  /** Revert to last-saved settings (discard pending changes) */
  revertSettings: () => void;
  /** Whether a save operation is in progress */
  saving: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  savedSettings: DEFAULT_SETTINGS,
  isDirty: false,
  updateSetting: () => {},
  updateNotification: () => {},
  saveSettings: async () => {},
  revertSettings: () => {},
  saving: false,
});

/* ────────── helper: apply theme to DOM ────────── */
function applyThemeToDOM(settings: AppSettings) {
  const root = document.documentElement;

  // Design Theme: apply CSS variables
  if (settings.designTheme === "shadow") {
    root.setAttribute("data-design-theme", "shadow");
  } else {
    root.setAttribute("data-design-theme", "institutional");
  }

  // Dark/Light mode
  if (settings.darkMode) {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
}

/* ────────── helper: read settings from localStorage ────────── */
function loadFromLocalStorage(): AppSettings | null {
  try {
    const raw = localStorage.getItem("onyx_settings");
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse errors
  }
  return null;
}

function saveToLocalStorage(settings: AppSettings) {
  localStorage.setItem("onyx_settings", JSON.stringify(settings));
}

/* ────────── helper: map backend UserSettings → AppSettings ────────── */
function mapBackendSettings(s: any): AppSettings {
  return {
    darkMode: s.darkMode ?? DEFAULT_SETTINGS.darkMode,
    designTheme: s.designTheme ?? DEFAULT_SETTINGS.designTheme,
    privacyMode: s.privacyMode ?? DEFAULT_SETTINGS.privacyMode,
    gasPreference: s.gasPreference ?? DEFAULT_SETTINGS.gasPreference,
    relayer: s.relayer ?? DEFAULT_SETTINGS.relayer,
    defaultPair: s.defaultPair ?? DEFAULT_SETTINGS.defaultPair,
    notifications: {
      proofVerified: s.notifProofVerified ?? DEFAULT_SETTINGS.notifications.proofVerified,
      orderMatched: s.notifOrderMatched ?? DEFAULT_SETTINGS.notifications.orderMatched,
      vaultActivity: s.notifVaultActivity ?? DEFAULT_SETTINGS.notifications.vaultActivity,
      systemUpdates: s.notifSystemUpdates ?? DEFAULT_SETTINGS.notifications.systemUpdates,
    },
  };
}

/* ────────── helper: map AppSettings → backend payload ────────── */
function mapToBackendPayload(s: AppSettings): Record<string, unknown> {
  return {
    darkMode: s.darkMode,
    designTheme: s.designTheme,
    privacyMode: s.privacyMode,
    gasPreference: s.gasPreference,
    relayer: s.relayer,
    defaultPair: s.defaultPair,
    notifProofVerified: s.notifications.proofVerified,
    notifOrderMatched: s.notifications.orderMatched,
    notifVaultActivity: s.notifications.vaultActivity,
    notifSystemUpdates: s.notifications.systemUpdates,
  };
}

/* ────────── provider ────────── */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { walletAddress, user } = useWallet();
  const [settings, setSettings] = useState<AppSettings>(() => {
    return loadFromLocalStorage() || DEFAULT_SETTINGS;
  });
  const [savedSettings, setSavedSettings] = useState<AppSettings>(() => {
    return loadFromLocalStorage() || DEFAULT_SETTINGS;
  });
  const [saving, setSaving] = useState(false);
  const initialLoadDone = useRef(false);

  // Sync from backend user settings when user loads
  useEffect(() => {
    if (user?.settings && !initialLoadDone.current) {
      const mapped = mapBackendSettings(user.settings);
      setSettings(mapped);
      setSavedSettings(mapped);
      saveToLocalStorage(mapped);
      initialLoadDone.current = true;
    }
  }, [user?.settings]);

  // Apply theme to DOM whenever settings change (preview)
  useEffect(() => {
    applyThemeToDOM(settings);
  }, [settings.darkMode, settings.designTheme]);

  // Reset on initial render
  useEffect(() => {
    applyThemeToDOM(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateNotification = useCallback(
    (key: keyof AppSettings["notifications"], value: boolean) => {
      setSettings((prev) => ({
        ...prev,
        notifications: { ...prev.notifications, [key]: value },
      }));
    },
    []
  );

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      if (walletAddress) {
        await userApi.updateSettings(walletAddress, mapToBackendPayload(settings));
      }
      setSavedSettings(settings);
      saveToLocalStorage(settings);
    } catch (err) {
      console.error("Failed to save settings:", err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [walletAddress, settings]);

  const revertSettings = useCallback(() => {
    setSettings(savedSettings);
    applyThemeToDOM(savedSettings);
  }, [savedSettings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        savedSettings,
        isDirty,
        updateSetting,
        updateNotification,
        saveSettings,
        revertSettings,
        saving,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
