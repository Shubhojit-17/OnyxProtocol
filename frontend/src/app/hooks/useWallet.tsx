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
import { WalletAccount, RpcProvider, constants, type AccountInterface } from "starknet";
import { userApi } from "../services/api";

const SEPOLIA_RPC = "https://api.cartridge.gg/x/starknet/sepolia";
const SN_SEPOLIA = constants.StarknetChainId.SN_SEPOLIA;

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

      // 1. Switch wallet to Sepolia network (important for Argent X)
      try {
        await selectedWallet.request({
          type: "wallet_switchStarknetChain",
          params: { chainId: SN_SEPOLIA },
        });
      } catch (switchErr: any) {
        console.warn("[Wallet] Chain switch to Sepolia failed (may already be on Sepolia):", switchErr?.message);
      }

      // 2. Create a proper RpcProvider instance for Sepolia
      const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });

      // 3. Connect the WalletAccount — requests accounts from the wallet
      //    and returns a fully-initialised WalletAccount that proxies
      //    signing through the wallet extension.
      const walletAccount = await WalletAccount.connect(
        provider,
        selectedWallet,
      );

      const address = walletAccount.address;
      if (!address) {
        throw new Error("No account address returned from wallet.");
      }

      console.log("[Wallet] Connected:", selectedWallet.name, address);

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

  /* ── on mount: try to silently reconnect to last wallet ── */
  useEffect(() => {
    const savedAddress = localStorage.getItem("onyx_wallet");
    if (!savedAddress) {
      setVerified(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Try silent reconnect (no modal) — works if the wallet extension
        // is still authorised from a previous session.
        const selectedWallet = await connect({ modalMode: "neverAsk" });

        if (cancelled) return;

        if (!selectedWallet) {
          // Wallet extension not available — clear stale state
          localStorage.removeItem("onyx_wallet");
          localStorage.removeItem("onyx_wallet_type");
          setVerified(true);
          return;
        }

        // Switch to Sepolia
        try {
          await selectedWallet.request({
            type: "wallet_switchStarknetChain",
            params: { chainId: SN_SEPOLIA },
          });
        } catch {
          // May already be on Sepolia
        }

        const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
        const walletAccount = await WalletAccount.connect(provider, selectedWallet);
        const address = walletAccount.address;

        if (cancelled) return;

        if (!address) {
          localStorage.removeItem("onyx_wallet");
          localStorage.removeItem("onyx_wallet_type");
          setVerified(true);
          return;
        }

        console.log("[Wallet] Auto-reconnected:", selectedWallet.name, address);

        setAccount(walletAccount);
        setStarknetWallet(selectedWallet);
        setWalletName(selectedWallet.name || "Starknet Wallet");
        await connectWithAddress(address);
      } catch (err) {
        console.warn("[Wallet] Auto-reconnect failed, clearing saved state:", err);
        localStorage.removeItem("onyx_wallet");
        localStorage.removeItem("onyx_wallet_type");
      } finally {
        if (!cancelled) setVerified(true);
      }
    })();

    return () => { cancelled = true; };
  }, [connectWithAddress]);

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
