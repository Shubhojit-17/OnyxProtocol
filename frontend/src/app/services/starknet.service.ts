/**
 * Starknet Service — Frontend integration with starknet.js
 *
 * Provides:
 *  - RPC provider for reading Starknet state
 *  - Contract instance for calling the OnyxDarkPool contract
 *  - ERC20 approve + vault deposit/withdraw with REAL token transfers
 *  - Helper functions for commitment submission
 */

import { RpcProvider, Contract, shortString, num, type AccountInterface, cairo, CallData } from "starknet";
import { ACTIVE_NETWORK, CONTRACT_ADDRESS, TOKEN_ADDRESSES, assetToFelt } from "./starknet.config";
import contractAbi from "../../../../contracts/abi/onyx_darkpool.json";

// ─── ERC20 ABI (minimal for approve, balanceOf, allowance) ──
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "external",
  },
  {
    name: "balance_of",
    type: "function",
    inputs: [
      { name: "account", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "core::starknet::contract_address::ContractAddress" },
      { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "external",
  },
];

// ─── Provider (read-only) ───────────────────────────────
let _provider: RpcProvider | null = null;

export function getProvider(): RpcProvider {
  if (!_provider) {
    _provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpcUrl });
  }
  return _provider;
}

// ─── Contract (read-only, no account) ───────────────────
let _readContract: Contract | null = null;

export function getReadContract(): Contract {
  if (!_readContract) {
    _readContract = new Contract({
      abi: contractAbi as any[],
      address: CONTRACT_ADDRESS,
      providerOrAccount: getProvider(),
    });
  }
  return _readContract;
}

// ─── Contract (with account for write operations) ───────
export function getWriteContract(account: AccountInterface): Contract {
  return new Contract({
    abi: contractAbi as any[],
    address: CONTRACT_ADDRESS,
    providerOrAccount: account,
  });
}

// ─── ERC20 Contract helpers ─────────────────────────────
export function getERC20ReadContract(tokenAddress: string): Contract {
  return new Contract({ abi: ERC20_ABI as any[], address: tokenAddress, providerOrAccount: getProvider() });
}

export function getERC20WriteContract(tokenAddress: string, account: AccountInterface): Contract {
  return new Contract({ abi: ERC20_ABI as any[], address: tokenAddress, providerOrAccount: account });
}

// ─── Token decimals (STRK=18, ETH=18) ──────────────────
export const TOKEN_DECIMALS: Record<string, number> = {
  STRK: 18,
  ETH: 18,
};

/** Convert human-readable amount to on-chain uint256 */
export function toTokenAmount(amount: number, symbol: string): bigint {
  const decimals = TOKEN_DECIMALS[symbol] || 18;
  return BigInt(Math.floor(amount * 10 ** decimals));
}

/** Convert on-chain uint256 to human-readable amount */
export function fromTokenAmount(amount: bigint, symbol: string): number {
  const decimals = TOKEN_DECIMALS[symbol] || 18;
  return Number(amount) / 10 ** decimals;
}

// ─── Read Operations ────────────────────────────────────

/**
 * Get the total number of commitments submitted on-chain.
 */
export async function getCommitmentCount(): Promise<number> {
  const contract = getReadContract();
  const result = await contract.get_commitment_count();
  return Number(result);
}

/**
 * Get the total number of matches recorded on-chain.
 */
export async function getMatchCount(): Promise<number> {
  const contract = getReadContract();
  const result = await contract.get_match_count();
  return Number(result);
}

/**
 * Get commitment details by ID.
 */
export async function getCommitment(commitmentId: number) {
  const contract = getReadContract();
  const result = await contract.get_commitment(commitmentId);
  return {
    hash: num.toHex(result[0]),
    assetIn: shortString.decodeShortString(num.toHex(result[1])),
    assetOut: shortString.decodeShortString(num.toHex(result[2])),
    status: Number(result[3]),
  };
}

/**
 * Get match details by ID.
 */
export async function getMatch(matchId: number) {
  const contract = getReadContract();
  const result = await contract.get_match(matchId);
  return {
    buyCommitmentId: Number(result[0]),
    sellCommitmentId: Number(result[1]),
    amount: num.toHex(result[2]),
    status: Number(result[3]),
  };
}

/**
 * Get vault balance for a user + token from on-chain contract.
 */
export async function getVaultBalance(
  userAddress: string,
  tokenSymbol: string
): Promise<bigint> {
  const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
  if (!tokenAddress) return BigInt(0);
  const contract = getReadContract();
  const result = await contract.get_vault_balance(userAddress, tokenAddress);
  return BigInt(result.toString());
}

/**
 * Get ERC20 wallet balance for a user + token.
 */
export async function getWalletTokenBalance(
  userAddress: string,
  tokenSymbol: string
): Promise<bigint> {
  const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
  if (!tokenAddress) return BigInt(0);
  const erc20 = getERC20ReadContract(tokenAddress);
  const result = await erc20.balance_of(userAddress);
  return BigInt(result.toString());
}

/**
 * Get the operator address.
 */
export async function getOperator(): Promise<string> {
  const contract = getReadContract();
  const result = await contract.get_operator();
  return num.toHex(result);
}

/**
 * Check if a token is supported on the contract.
 */
export async function isTokenSupported(tokenSymbol: string): Promise<boolean> {
  const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
  if (!tokenAddress) return false;
  const contract = getReadContract();
  const result = await contract.is_token_supported(tokenAddress);
  return Boolean(result);
}

// ─── Write Operations (require account) ─────────────────

/**
 * Submit an order commitment on-chain.
 */
export async function submitCommitmentOnChain(
  account: AccountInterface,
  commitmentHash: string,
  assetIn: string,
  assetOut: string,
  encryptedAmount: string,
  encryptedPrice: string
): Promise<{ transactionHash: string }> {
  const contract = getWriteContract(account);

  const assetInFelt = assetToFelt(assetIn);
  const assetOutFelt = assetToFelt(assetOut);

  const result = await contract.invoke("submit_commitment", [
    commitmentHash,
    assetInFelt,
    assetOutFelt,
    encryptedAmount,
    encryptedPrice,
  ]);

  const provider = getProvider();
  await provider.waitForTransaction(result.transaction_hash);

  return { transactionHash: result.transaction_hash };
}

/**
 * Deposit ERC20 tokens into the on-chain vault.
 * This does TWO transactions via multicall:
 *   1. ERC20 approve(contract, amount)
 *   2. OnyxDarkPool vault_deposit(token, amount)
 */
export async function vaultDepositOnChain(
  account: AccountInterface,
  tokenSymbol: string,
  amount: bigint
): Promise<{ transactionHash: string }> {
  const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
  if (!tokenAddress) throw new Error(`Unsupported token: ${tokenSymbol}`);

  // Use multicall: approve + deposit in a single transaction
  const u256Amount = cairo.uint256(amount);

  const calls = [
    // 1. Approve the dark pool contract to spend tokens
    {
      contractAddress: tokenAddress,
      entrypoint: "approve",
      calldata: CallData.compile({
        spender: CONTRACT_ADDRESS,
        amount: u256Amount,
      }),
    },
    // 2. Deposit into the vault
    {
      contractAddress: CONTRACT_ADDRESS,
      entrypoint: "vault_deposit",
      calldata: CallData.compile({
        token: tokenAddress,
        amount: u256Amount,
      }),
    },
  ];

  console.log("[Starknet] Executing deposit multicall:", {
    token: tokenSymbol,
    tokenAddress,
    amount: amount.toString(),
    callsCount: calls.length,
  });

  let result;
  try {
    result = await account.execute(calls);
  } catch (err: any) {
    // Provide user-friendly error messages for common wallet errors
    const msg = err?.message || err?.code || String(err);
    if (msg.includes("NOT_FOUND") || msg.includes("Account not found")) {
      throw new Error(
        "Wallet account not found. Please make sure your wallet is on Starknet Sepolia network, " +
        "then disconnect and reconnect your wallet."
      );
    }
    if (msg.includes("rejected") || msg.includes("USER_REFUSED")) {
      throw new Error("Transaction rejected by user.");
    }
    throw new Error(`Wallet error: ${msg}`);
  }

  const provider = getProvider();
  await provider.waitForTransaction(result.transaction_hash);

  return { transactionHash: result.transaction_hash };
}

/**
 * Withdraw ERC20 tokens from the on-chain vault.
 * Single transaction: vault_withdraw(token, amount)
 */
export async function vaultWithdrawOnChain(
  account: AccountInterface,
  tokenSymbol: string,
  amount: bigint
): Promise<{ transactionHash: string }> {
  const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
  if (!tokenAddress) throw new Error(`Unsupported token: ${tokenSymbol}`);

  // Use multicall-style execute for withdraw (same wallet integration pattern)
  const u256Amount = cairo.uint256(amount);
  const calls = [
    {
      contractAddress: CONTRACT_ADDRESS,
      entrypoint: "vault_withdraw",
      calldata: CallData.compile({
        token: tokenAddress,
        amount: u256Amount,
      }),
    },
  ];

  let result;
  try {
    result = await account.execute(calls);
  } catch (err: any) {
    const msg = err?.message || err?.code || String(err);
    if (msg.includes("NOT_FOUND") || msg.includes("Account not found")) {
      throw new Error(
        "Wallet account not found. Please make sure your wallet is on Starknet Sepolia network, " +
        "then disconnect and reconnect your wallet."
      );
    }
    if (msg.includes("rejected") || msg.includes("USER_REFUSED")) {
      throw new Error("Transaction rejected by user.");
    }
    throw new Error(`Wallet error: ${msg}`);
  }

  const provider = getProvider();
  await provider.waitForTransaction(result.transaction_hash);

  return { transactionHash: result.transaction_hash };
}

// ─── Transaction Helpers ────────────────────────────────

/**
 * Get the explorer URL for a transaction hash.
 */
export function getTxExplorerUrl(txHash: string): string {
  return ACTIVE_NETWORK.explorerTxUrl(txHash);
}

/**
 * Get the explorer URL for a contract address.
 */
export function getContractExplorerUrl(address: string): string {
  return ACTIVE_NETWORK.explorerContractUrl(address);
}

/**
 * Check if a contract is deployed at the configured address.
 */
export async function isContractDeployed(): Promise<boolean> {
  if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return false;
  }
  try {
    const provider = getProvider();
    const classHash = await provider.getClassHashAt(CONTRACT_ADDRESS);
    return !!classHash;
  } catch {
    return false;
  }
}
