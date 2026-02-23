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
import { STARKNET_CONFIG, assetToFelt } from "./starknet.config.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── ABI ────────────────────────────────────────────────
let contractAbi: any[];
try {
  const abiPath = resolve(__dirname, "../../../contracts/abi/onyx_darkpool.json");
  contractAbi = JSON.parse(readFileSync(abiPath, "utf-8"));
} catch {
  console.warn("[Starknet] Could not load contract ABI — on-chain operations will be simulated");
  contractAbi = [];
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
 * Record a match on-chain (operator call).
 * Returns the transaction hash or null if simulated.
 */
export async function recordMatchOnChain(
  buyCommitmentOnChainId: number,
  sellCommitmentOnChainId: number,
  matchedAmount: string
): Promise<string | null> {
  const contract = getWriteContract();
  if (!contract) {
    console.log(
      `[Starknet] SIMULATED record_match(buy=${buyCommitmentOnChainId}, sell=${sellCommitmentOnChainId})`
    );
    return null;
  }

  try {
    const result = await contract.invoke("record_match", [
      buyCommitmentOnChainId,
      sellCommitmentOnChainId,
      matchedAmount,
    ]);
    await getProvider().waitForTransaction(result.transaction_hash);
    console.log(`[Starknet] Match recorded on-chain: ${result.transaction_hash}`);
    return result.transaction_hash;
  } catch (err) {
    console.error("[Starknet] Failed to record match on-chain:", err);
    return null;
  }
}

/**
 * Settle a match on-chain (operator call).
 * Returns the transaction hash or null if simulated.
 */
export async function settleMatchOnChain(
  onChainMatchId: number,
  proofHash: string
): Promise<string | null> {
  const contract = getWriteContract();
  if (!contract) {
    console.log(
      `[Starknet] SIMULATED settle_match(matchId=${onChainMatchId}, proof=${proofHash.slice(0, 16)}...)`
    );
    return null;
  }

  try {
    const result = await contract.invoke("settle_match", [
      onChainMatchId,
      proofHash,
    ]);
    await getProvider().waitForTransaction(result.transaction_hash);
    console.log(`[Starknet] Match settled on-chain: ${result.transaction_hash}`);
    return result.transaction_hash;
  } catch (err) {
    console.error("[Starknet] Failed to settle match on-chain:", err);
    return null;
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
