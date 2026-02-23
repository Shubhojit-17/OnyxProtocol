import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { connect, disconnect as sn_disconnect } from "@starknet-io/get-starknet";
import type { StarknetWindowObject } from "@starknet-io/get-starknet";
import { WalletAccount, type AccountInterface } from "starknet";
import { userApi } from "../services/api";

/* ────────────────────────────────────────────────────────
   Starknet Wallet Context for Onyx Protocol
   Supports ArgentX, Braavos, and other Starknet wallets
   via the get-starknet standard.
   ──────────────────────────────────────────────────────── */

/* ────────── context shape ────────── */
interface WalletContextType {
  /** The Starknet account address (hex string) */
  walletAddress: string | null;
  /** Backend user record */
  user: any | null;
  /** The starknet.js Account interface for signing txs */
  account: AccountInterface | null;
  /** The connected wallet object (ArgentX / Braavos) */
  starknetWallet: StarknetWindowObject | null;
  /** Wallet display name (e.g. "Argent X", "Braavos") */
  walletName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  /** true once mount-time check has finished */
  verified: boolean;
  /** Connect a Starknet wallet (opens wallet selector modal) */
  connectStarknet: () => Promise<void>;
  /** Legacy alias for backwards compatibility */
  connectMetaMask: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  walletAddress: null,
  user: null,
  account: null,
  starknetWallet: null,
  walletName: null,
  isConnected: false,
  isConnecting: false,
  verified: false,
  connectStarknet: async () => {},
  connectMetaMask: async () => {},
  disconnect: () => {},
});

/* ────────── provider ────────── */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [account, setAccount] = useState<AccountInterface | null>(null);
  const [starknetWallet, setStarknetWallet] = useState<StarknetWindowObject | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [verified, setVerified] = useState(false);
  const disconnectingRef = useRef(false);

  /* ── helper: register wallet with backend ── */
  const connectWithAddress = useCallback(async (address: string) => {
    const { user: u } = await userApi.connect(address);
    setWalletAddress(address);
    setUser(u);
    localStorage.setItem("onyx_wallet", address);
    localStorage.setItem("onyx_wallet_type", "starknet");
  }, []);

  /* ── connect Starknet wallet (ArgentX / Braavos) ── */
  const connectStarknet = useCallback(async () => {
    setIsConnecting(true);
    try {
      /*
       * connect() from @starknet-io/get-starknet shows a wallet selection
       * modal. It returns the StarknetWindowObject for the chosen wallet.
       */
      const selectedWallet = await connect({
        modalMode: "alwaysAsk",
        modalTheme: "dark",
      });

      if (!selectedWallet) {
        throw new Error("No wallet selected. Please install ArgentX or Braavos.");
      }

      // Use the static connect helper — it requests accounts from the
      // wallet and returns a fully-initialised WalletAccount.
      const walletAccount = await WalletAccount.connect(
        { nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia" },
        selectedWallet,
      );

      const address = walletAccount.address;
      if (!address) {
        throw new Error("No account address returned from wallet.");
      }

      setAccount(walletAccount);
      setStarknetWallet(selectedWallet);
      setWalletName(selectedWallet.name || "Starknet Wallet");
      await connectWithAddress(address);
      setVerified(true);
    } finally {
      setIsConnecting(false);
    }
  }, [connectWithAddress]);

  /* ── disconnect ── */
  const handleDisconnect = useCallback(async () => {
    if (disconnectingRef.current) return;
    disconnectingRef.current = true;

    try {
      await sn_disconnect({ clearLastWallet: true });
    } catch {
      // ignore disconnect errors
    }

    setWalletAddress(null);
    setUser(null);
    setAccount(null);
    setStarknetWallet(null);
    setWalletName(null);
    setVerified(false);
    localStorage.removeItem("onyx_wallet");
    localStorage.removeItem("onyx_wallet_type");

    disconnectingRef.current = false;
  }, []);

  /* ── on mount: clear any stale stored wallet ── */
  useEffect(() => {
    localStorage.removeItem("onyx_wallet");
    setVerified(true);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        user,
        account,
        starknetWallet,
        walletName,
        isConnected: verified && !!walletAddress,
        isConnecting,
        verified,
        connectStarknet,
        connectMetaMask: connectStarknet, // alias for backwards compat
        disconnect: handleDisconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
