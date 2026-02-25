/// Starknet configuration for Onyx Protocol
/// This file configures connection to the Starknet network.
///
/// For local development: Use Starknet Devnet (starknet-devnet --seed=0)
/// For testnet: Use Starknet Sepolia

// ─── Network Configuration ─────────────────────────────
export const STARKNET_CONFIG = {
  // Starknet Sepolia testnet (default for hackathon)
  SEPOLIA: {
    name: "Starknet Sepolia",
    chainId: "SN_SEPOLIA",
    rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia",
    explorerUrl: "https://sepolia.voyager.online",
    explorerTxUrl: (txHash: string) =>
      `https://sepolia.voyager.online/tx/${txHash}`,
    explorerContractUrl: (address: string) =>
      `https://sepolia.voyager.online/contract/${address}`,
  },

  // Local Starknet Devnet (for offline development)
  DEVNET: {
    name: "Starknet Devnet",
    chainId: "SN_SEPOLIA",
    rpcUrl: "http://127.0.0.1:5050",
    explorerUrl: "",
    explorerTxUrl: (txHash: string) => `#tx-${txHash}`,
    explorerContractUrl: (address: string) => `#contract-${address}`,
  },
} as const;

// Active network — switch this for development vs testnet
export const ACTIVE_NETWORK =
  import.meta.env.VITE_STARKNET_NETWORK === "devnet"
    ? STARKNET_CONFIG.DEVNET
    : STARKNET_CONFIG.SEPOLIA;

// ─── Contract Addresses ─────────────────────────────────
// These get set after deployment. Override via env vars.
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_DARKPOOL_CONTRACT_ADDRESS ||
  "0x0427594391b8caeffe640c1af3027f527b890182f711f8408cdd02624108a303";

// ─── ERC20 Token Addresses (Starknet Sepolia) ──────────
export const TOKEN_ADDRESSES: Record<string, string> = {
  STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  oETH: "0x016cb8266e5094847ee3d4a5a7af4581c7827b76f9337f909538e2dde0f34f4f",
  oSEP: "0x02bec35828c51118ad5841fbf4670bf11485fcb2f212c5bfd0b96e3c22f72ff3",
};

// All supported tokens with display metadata
export const SUPPORTED_TOKENS = [
  { symbol: "STRK", name: "Starknet Token", decimals: 18, color: "#7B3FE4" },
  { symbol: "oETH", name: "Onyx Ethereum", decimals: 18, color: "#627EEA" },
  { symbol: "oSEP", name: "Onyx Sepolia", decimals: 18, color: "#4ade80" },
] as const;

// Available trading pairs (base / quote)
export const TRADING_PAIRS = [
  { base: "STRK", quote: "oETH", label: "STRK / oETH" },
  { base: "STRK", quote: "oSEP", label: "STRK / oSEP" },
  { base: "oETH", quote: "oSEP", label: "oETH / oSEP" },
] as const;

// ─── Supported Starknet Wallets ─────────────────────────
export const SUPPORTED_WALLETS = [
  {
    id: "argentX",
    name: "Argent X",
    icon: "/wallets/argent.svg",
    downloadUrl: "https://www.argent.xyz/argent-x/",
  },
  {
    id: "braavos",
    name: "Braavos",
    icon: "/wallets/braavos.svg",
    downloadUrl: "https://braavos.app/",
  },
] as const;

// ─── Asset to felt252 mapping (short strings) ──────────
// Cairo felt252 can store strings up to 31 bytes.
// We use these as asset identifiers on-chain.
export const ASSET_FELT_MAP: Record<string, string> = {
  "STRK": "0x5354524b",          // "STRK"
  "ETH": "0x455448",             // "ETH"
  "oETH": "0x6f455448",          // "oETH"
  "oSEP": "0x6f534550",          // "oSEP"
};

export function assetToFelt(symbol: string): string {
  return ASSET_FELT_MAP[symbol] || "0x0";
}
