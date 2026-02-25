/**
 * Starknet Configuration — Backend
 *
 * Manages connection to the Starknet network for on-chain operations:
 *  - Recording matches
 *  - Settling trades
 *  - Reading on-chain state
 */

import dotenv from "dotenv";
dotenv.config();

export const STARKNET_CONFIG = {
  // RPC URL for Starknet Sepolia
  rpcUrl:
    process.env.STARKNET_RPC_URL ||
    "https://api.cartridge.gg/x/starknet/sepolia",

  // The deployed OnyxDarkPool contract address
  contractAddress:
    process.env.STARKNET_CONTRACT_ADDRESS ||
    "0x0000000000000000000000000000000000000000000000000000000000000000",

  // Operator private key (for signing match/settle transactions)
  operatorPrivateKey: process.env.STARKNET_OPERATOR_PRIVATE_KEY || "",

  // Operator account address
  operatorAddress: process.env.STARKNET_OPERATOR_ADDRESS || "",

  // Explorer base URL
  explorerUrl: process.env.STARKNET_EXPLORER_URL || "https://sepolia.voyager.online",

  // Whether on-chain integration is active
  // If false, the system still works with simulated settlement (for dev without devnet)
  get isEnabled(): boolean {
    return (
      this.contractAddress !==
        "0x0000000000000000000000000000000000000000000000000000000000000000" &&
      this.operatorPrivateKey !== ""
    );
  },

  txUrl(txHash: string): string {
    return `${this.explorerUrl}/tx/${txHash}`;
  },

  contractUrl(): string {
    return `${this.explorerUrl}/contract/${this.contractAddress}`;
  },
} as const;

// ERC20 Token Addresses (Starknet Sepolia)
export const TOKEN_ADDRESSES: Record<string, string> = {
  STRK: process.env.STRK_TOKEN_ADDRESS || "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  ETH: process.env.ETH_TOKEN_ADDRESS || "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  oETH: process.env.oETH_TOKEN_ADDRESS || "0x016cb8266e5094847ee3d4a5a7af4581c7827b76f9337f909538e2dde0f34f4f",
  oSEP: process.env.oSEP_TOKEN_ADDRESS || "0x02bec35828c51118ad5841fbf4670bf11485fcb2f212c5bfd0b96e3c22f72ff3",
};

// Symbol -> token contract address mapping
export function symbolToTokenAddress(symbol: string): string | undefined {
  return TOKEN_ADDRESSES[symbol];
}

// Asset -> felt252 mapping (for commitment identifiers)
export const ASSET_FELT_MAP: Record<string, string> = {
  STRK: "0x5354524b",
  ETH: "0x455448",
  oETH: "0x6f455448",
  oSEP: "0x6f534550",
};

export function assetToFelt(symbol: string): string {
  return ASSET_FELT_MAP[symbol] || "0x0";
}
