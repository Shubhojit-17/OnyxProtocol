import { createBrowserRouter } from "react-router";
import LandingPage from "./pages/LandingPage";
import ConnectWalletPage from "./pages/ConnectWalletPage";
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardOverviewPage from "./pages/DashboardOverviewPage";
import TradePage from "./pages/TradePage";
import DarkPoolPage from "./pages/DarkPoolPage";
import ExecutionPage from "./pages/ExecutionPage";
import VaultPage from "./pages/VaultPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import HistoryPage from "./pages/HistoryPage";
import CompliancePage from "./pages/CompliancePage";
import SettingsPage from "./pages/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/connect",
    Component: ConnectWalletPage,
  },
  {
    path: "/app",
    Component: DashboardLayout,
    children: [
      { index: true, Component: DashboardOverviewPage },
      { path: "trade", Component: TradePage },
      { path: "dark-pool", Component: DarkPoolPage },
      { path: "execution", Component: ExecutionPage },
      { path: "vault", Component: VaultPage },
      { path: "analytics", Component: AnalyticsPage },
      { path: "history", Component: HistoryPage },
      { path: "compliance", Component: CompliancePage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
