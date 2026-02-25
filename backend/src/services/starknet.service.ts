/**
 * Starknet Service — Backend integration with starknet.js
 *
 * Handles on-chain operations for the OnyxDarkPool contract:
 *  - Recording matches (operator-signed tx)
 *  - Settling matched trades (operator-signed tx)
 *  - Reading on-chain state
 *
 * When the contract is not deployed (dev mode), operations are
 * simulated and logged, so the rest of the system keeps working.
 */

import { RpcProvider, Account, Contract, shortString, num } from "starknet";
import { STARKNET_CONFIG, TOKEN_ADDRESSES, assetToFelt } from "./starknet.config.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Timeout for on-chain operations ────────────────────
const ON_CHAIN_TIMEOUT_MS = 60_000; // 60 seconds max per on-chain operation

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[Starknet] ${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── ABI ────────────────────────────────────────────────
let contractAbi: any[];
try {
  const abiPath = resolve(__dirname, "..", "..", "..", "contracts", "abi", "onyx_darkpool.json");
  const raw = readFileSync(abiPath, "utf-8");
  const parsed = JSON.parse(raw);
  // ABI may be nested inside a wrapper object
  contractAbi = Array.isArray(parsed) ? parsed : (parsed.abi || []);
  console.log(`[Starknet] Contract ABI loaded (${contractAbi.length} entries)`);
} catch (err: any) {
  console.warn("[Starknet] ABI load error:", err?.message || err);
  // Try alternative path (relative to cwd parent)
  try {
    const altPath = resolve(process.cwd(), "..", "contracts", "abi", "onyx_darkpool.json");
    const raw = readFileSync(altPath, "utf-8");
    const parsed = JSON.parse(raw);
    contractAbi = Array.isArray(parsed) ? parsed : (parsed.abi || []);
    console.log(`[Starknet] Contract ABI loaded from alt path (${contractAbi.length} entries)`);
  } catch {
    console.warn("[Starknet] Could not load contract ABI — on-chain operations will be simulated");
    contractAbi = [];
  }
}

// ─── Provider ───────────────────────────────────────────
let _provider: RpcProvider | null = null;

function getProvider(): RpcProvider {
  if (!_provider) {
    _provider = new RpcProvider({ nodeUrl: STARKNET_CONFIG.rpcUrl });
  }
  return _provider;
}

// ─── Operator Account ───────────────────────────────────
let _operatorAccount: Account | null = null;

function getOperatorAccount(): Account | null {
  if (!STARKNET_CONFIG.isEnabled) return null;
  if (!_operatorAccount) {
    _operatorAccount = new Account({
      provider: getProvider(),
      address: STARKNET_CONFIG.operatorAddress,
      signer: STARKNET_CONFIG.operatorPrivateKey,
    });
  }
  return _operatorAccount;
}

// ─── Contract (read-only) ───────────────────────────────
function getReadContract(): Contract | null {
  if (!STARKNET_CONFIG.isEnabled || contractAbi.length === 0) return null;
  return new Contract({ abi: contractAbi, address: STARKNET_CONFIG.contractAddress, providerOrAccount: getProvider() });
}

// ─── Contract (with operator account) ───────────────────
function getWriteContract(): Contract | null {
  const account = getOperatorAccount();
  if (!account || contractAbi.length === 0) return null;
  return new Contract({ abi: contractAbi, address: STARKNET_CONFIG.contractAddress, providerOrAccount: account });
}

// ═══════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════

/**
 * Check if on-chain integration is available.
 */
export function isStarknetEnabled(): boolean {
  return STARKNET_CONFIG.isEnabled;
}

/**
 * Get the explorer URL for a transaction.
 */
export function getTxUrl(txHash: string): string {
  return STARKNET_CONFIG.txUrl(txHash);
}

/**
 * Convert a hex string or arbitrary string to a valid felt252 value.
 * felt252 max is ~2^252, so we truncate to 62 hex digits (248 bits) to be safe.
 */
function toFelt252(value: string): string {
  if (!value || value === "0" || value === "0x0") return "0x0";
  // If it's already a hex string
  if (value.startsWith("0x")) {
    const hex = value.slice(2);
    // Truncate to 62 hex characters (248 bits) — safely within felt252 range
    return "0x" + hex.slice(0, 62);
  }
  // Convert string to hex
  const hex = Buffer.from(value).toString("hex");
  return "0x" + hex.slice(0, 62);
}

/**
 * Submit an order commitment on-chain (operator call).
 * Throws on failure — no simulation fallback.
 */
export async function submitCommitmentOnChain(
  commitmentHash: string,
  assetIn: string,
  assetOut: string,
  encryptedAmount: string,
  encryptedPrice: string
): Promise<{ txHash: string; onChainId: number }> {
  const contract = getWriteContract();
  if (!contract) {
    throw new Error(`[Starknet] Cannot submit commitment — contract not available (ABI missing or Starknet not configured)`);
  }

  try {
    // Convert asset symbols to felt252
    const assetInFelt = assetToFelt(assetIn);
    const assetOutFelt = assetToFelt(assetOut);
    // Truncate commitment hash to fit felt252 (max ~252 bits = 63 hex digits)
    // Take first 62 hex digits (248 bits) to guarantee it's within range
    const hashFelt = toFelt252(commitmentHash);
    // Convert encrypted amount/price to felt252
    const amountFelt = toFelt252(encryptedAmount);
    const priceFelt = toFelt252(encryptedPrice);

    console.log(`[Starknet] submit_commitment: hash=${hashFelt.slice(0, 16)}..., ${assetIn}→${assetOut}`);
    const result = await contract.invoke("submit_commitment", [
      hashFelt,
      assetInFelt,
      assetOutFelt,
      amountFelt,
      priceFelt,
    ]);

    const receipt = await withTimeout(
      getProvider().waitForTransaction(result.transaction_hash),
      ON_CHAIN_TIMEOUT_MS,
      `waitForTransaction(submit_commitment ${result.transaction_hash.slice(0, 16)}...)`
    );
    
    // Extract commitment_id from the event
    let onChainId = 0;
    try {
      // The CommitmentSubmitted event has commitment_id as the first key
      const events = (receipt as any).events || [];
      for (const event of events) {
        if (event.keys && event.keys.length > 1) {
          // commitment_id is typically in keys[1] (keys[0] is event selector)
          onChainId = Number(BigInt(event.keys[1]));
          if (onChainId > 0) break;
        }
      }
      if (onChainId === 0) {
        // Fallback: read commitment_count from contract
        const readContract = getReadContract();
        if (readContract) {
          const count = await readContract.get_commitment_count();
          onChainId = Number(count);
        }
      }
    } catch (parseErr) {
      console.warn("[Starknet] Could not parse commitment ID from receipt, reading from contract");
      const readContract = getReadContract();
      if (readContract) {
        const count = await readContract.get_commitment_count();
        onChainId = Number(count);
      }
    }

    console.log(`[Starknet] Commitment submitted on-chain: id=${onChainId}, tx=${result.transaction_hash}`);
    return { txHash: result.transaction_hash, onChainId };
  } catch (err: any) {
    console.error("[Starknet] Failed to submit commitment on-chain:", err);
    throw new Error(`[Starknet] submit_commitment failed: ${err?.message || err}`);
  }
}

/**
 * Record a match on-chain (operator call).
 * Throws on failure — no simulation fallback.
 */
export async function recordMatchOnChain(
  buyCommitmentOnChainId: number,
  sellCommitmentOnChainId: number,
  matchedAmount: string
): Promise<{ txHash: string; onChainMatchId: number }> {
  const contract = getWriteContract();
  if (!contract) {
    throw new Error(`[Starknet] Cannot record match — contract not available (ABI missing or Starknet not configured)`);
  }

  try {
    const result = await contract.invoke("record_match", [
      buyCommitmentOnChainId,
      sellCommitmentOnChainId,
      toFelt252(matchedAmount),
    ]);
    const receipt = await withTimeout(
      getProvider().waitForTransaction(result.transaction_hash),
      ON_CHAIN_TIMEOUT_MS,
      `waitForTransaction(record_match ${result.transaction_hash.slice(0, 16)}...)`
    );
    
    // Extract match_id from the MatchRecorded event
    let onChainMatchId = 0;
    try {
      const events = (receipt as any).events || [];
      for (const event of events) {
        if (event.keys && event.keys.length > 1) {
          onChainMatchId = Number(BigInt(event.keys[1]));
          if (onChainMatchId > 0) break;
        }
      }
      if (onChainMatchId === 0) {
        const readContract = getReadContract();
        if (readContract) {
          const count = await readContract.get_match_count();
          onChainMatchId = Number(count);
        }
      }
    } catch (parseErr) {
      console.warn("[Starknet] Could not parse match ID from receipt, reading from contract");
      const readContract = getReadContract();
      if (readContract) {
        const count = await readContract.get_match_count();
        onChainMatchId = Number(count);
      }
    }

    console.log(`[Starknet] Match recorded on-chain: matchId=${onChainMatchId}, tx=${result.transaction_hash}`);
    return { txHash: result.transaction_hash, onChainMatchId };
  } catch (err: any) {
    console.error("[Starknet] Failed to record match on-chain:", err);
    throw new Error(`[Starknet] record_match failed: ${err?.message || err}`);
  }
}

/**
 * Settle a match on-chain (operator call).
 * Throws on failure — no simulation fallback.
 */
export async function settleMatchOnChain(
  onChainMatchId: number,
  proofHash: string
): Promise<string> {
  const contract = getWriteContract();
  if (!contract) {
    throw new Error(`[Starknet] Cannot settle match — contract not available (ABI missing or Starknet not configured)`);
  }

  try {
    // Convert proofHash to felt252
    const proofFelt = toFelt252(proofHash);
    
    const result = await contract.invoke("settle_match", [
      onChainMatchId,
      proofFelt,
    ]);
    const receipt = await withTimeout(
      getProvider().waitForTransaction(result.transaction_hash),
      ON_CHAIN_TIMEOUT_MS,
      `waitForTransaction(settle_match ${result.transaction_hash.slice(0, 16)}...)`
    );
    console.log(`[Starknet] Match settled on-chain: ${result.transaction_hash}`);
    return result.transaction_hash;
  } catch (err: any) {
    console.error("[Starknet] Failed to settle match on-chain:", err);
    throw new Error(`[Starknet] settle_match failed: ${err?.message || err}`);
  }
}

// ─── Read Operations ────────────────────────────────────

/**
 * Get the on-chain commitment count.
 */
export async function getCommitmentCount(): Promise<number> {
  const contract = getReadContract();
  if (!contract) return 0;
  try {
    const result = await contract.get_commitment_count();
    return Number(result);
  } catch {
    return 0;
  }
}

/**
 * Get the on-chain match count.
 */
export async function getMatchCount(): Promise<number> {
  const contract = getReadContract();
  if (!contract) return 0;
  try {
    const result = await contract.get_match_count();
    return Number(result);
  } catch {
    return 0;
  }
}

/**
 * Verify the contract is deployed and accessible.
 */
export async function verifyContractDeployed(): Promise<boolean> {
  if (!STARKNET_CONFIG.isEnabled) return false;
  try {
    const provider = getProvider();
    const classHash = await provider.getClassHashAt(STARKNET_CONFIG.contractAddress);
    return !!classHash;
  } catch {
    return false;
  }
}

// ─── Mock ERC20 ABI (for faucet minting) ─────────────────
let mockErc20Abi: any[] = [];
try {
  const mockAbiPath = resolve(__dirname, "..", "..", "..", "contracts", "abi", "mock_erc20.json");
  const rawMock = readFileSync(mockAbiPath, "utf-8");
  const parsedMock = JSON.parse(rawMock);
  mockErc20Abi = Array.isArray(parsedMock) ? parsedMock : (parsedMock.abi || []);
  console.log(`[Starknet] MockERC20 ABI loaded (${mockErc20Abi.length} entries)`);
} catch {
  try {
    const altMockPath = resolve(process.cwd(), "..", "contracts", "abi", "mock_erc20.json");
    const rawMock = readFileSync(altMockPath, "utf-8");
    const parsedMock = JSON.parse(rawMock);
    mockErc20Abi = Array.isArray(parsedMock) ? parsedMock : (parsedMock.abi || []);
    console.log(`[Starknet] MockERC20 ABI loaded from alt path (${mockErc20Abi.length} entries)`);
  } catch {
    console.warn("[Starknet] Could not load MockERC20 ABI — faucet will not work");
  }
}

/**
 * Faucet: mint mock tokens (oETH / oSEP) directly to a user's wallet.
 * Uses mint_to(to, amount) on the MockERC20 contract.
 */
export async function faucetMintTokens(
  recipientAddress: string,
  symbol: "oETH" | "oSEP",
  amount: bigint
): Promise<string | null> {
  const account = getOperatorAccount();
  if (!account || mockErc20Abi.length === 0) {
    console.log(`[Starknet] SIMULATED faucet mint ${symbol} to ${recipientAddress}`);
    return null;
  }

  const tokenAddress = TOKEN_ADDRESSES[symbol];
  if (!tokenAddress) throw new Error(`Unknown mock token: ${symbol}`);

  const tokenContract = new Contract({
    abi: mockErc20Abi,
    address: tokenAddress,
    providerOrAccount: account,
  });

  try {
    // u256 is passed as { low, high } or as two felts in starknet.js v9
    const result = await tokenContract.invoke("mint_to", [
      recipientAddress,
      amount,
    ]);
    await withTimeout(
      getProvider().waitForTransaction(result.transaction_hash),
      ON_CHAIN_TIMEOUT_MS,
      `waitForTransaction(mint_to ${result.transaction_hash.slice(0, 16)}...)`
    );
    console.log(`[Starknet] Faucet minted ${amount} ${symbol} to ${recipientAddress}: ${result.transaction_hash}`);
    return result.transaction_hash;
  } catch (err: any) {
    console.error(`[Starknet] Faucet mint failed:`, err);
    throw new Error(`Faucet mint failed: ${err.message || err}`);
  }
}

/**
 * Get Starknet network status info.
 */
export async function getNetworkInfo() {
  const enabled = STARKNET_CONFIG.isEnabled;
  let blockNumber = 0;
  let contractDeployed = false;

  if (enabled) {
    try {
      const provider = getProvider();
      const block = await provider.getBlockNumber();
      blockNumber = block;
    } catch {
      // ignore
    }
    contractDeployed = await verifyContractDeployed();
  }

  return {
    enabled,
    network: "Starknet Sepolia",
    rpcUrl: STARKNET_CONFIG.rpcUrl,
    contractAddress: STARKNET_CONFIG.contractAddress,
    contractDeployed,
    operatorAddress: STARKNET_CONFIG.operatorAddress || null,
    blockNumber,
    explorerUrl: STARKNET_CONFIG.explorerUrl,
  };
}
