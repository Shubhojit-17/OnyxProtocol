import { RouterProvider } from "react-router";
import { router } from "./routes";
import { WalletProvider } from "./hooks/useWallet";
import { SettingsProvider } from "./hooks/useSettings";

export default function App() {
  return (
    <WalletProvider>
      <SettingsProvider>
        <RouterProvider router={router} />
      </SettingsProvider>
    </WalletProvider>
  );
}
