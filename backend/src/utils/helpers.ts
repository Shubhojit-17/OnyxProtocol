import crypto from "crypto";

/** Generate a hex commitment hash */
export function generateCommitmentHash(): string {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

/** Generate a fake proof ID */
export function generateProofId(): string {
  return "0x" + crypto.randomBytes(16).toString("hex");
}

/** Generate a fake TX hash */
export function generateTxHash(): string {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

/** Generate a viewing key */
export function generateViewingKey(): string {
  return "vk_" + crypto.randomBytes(24).toString("base64url");
}

/** Random integer between min and max inclusive */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random float between min and max */
export function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/** Format a USD value */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Sleep for ms */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Truncate address for display */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Short order ID from UUID */
export function shortOrderId(uuid: string): string {
  const num = parseInt(uuid.replace(/-/g, "").slice(0, 8), 16) % 10000;
  return `TRD-${num.toString().padStart(4, "0")}`;
}

/** Short match ID */
export function shortMatchId(uuid: string): string {
  const num = parseInt(uuid.replace(/-/g, "").slice(0, 8), 16) % 10000;
  return `MTH-${num.toString().padStart(4, "0")}`;
}
