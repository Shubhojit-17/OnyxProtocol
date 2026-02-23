import { RouterProvider } from "react-router";
import { router } from "./routes";
import { WalletProvider } from "./hooks/useWallet";

export default function App() {
  return (
    <WalletProvider>
      <RouterProvider router={router} />
    </WalletProvider>
  );
}
