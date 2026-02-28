import prisma from "../db/prisma.js";
import { wsManager } from "../websocket/manager.js";

export async function connectUser(walletAddress: string) {
  let user = await prisma.user.findUnique({
    where: { walletAddress },
    include: { settings: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        walletAddress,
        settings: { create: {} },
        vaultBalances: {
          create: [
            { assetSymbol: "STRK", publicBalance: 0, shieldedBalance: 0, lockedBalance: 0 },
            { assetSymbol: "oETH", publicBalance: 0, shieldedBalance: 0, lockedBalance: 0 },
            { assetSymbol: "oSEP", publicBalance: 0, shieldedBalance: 0, lockedBalance: 0 },
          ],
        },
      },
      include: { settings: true },
    });
  }

  return user;
}

export async function getUserByWallet(walletAddress: string) {
  return prisma.user.findUnique({
    where: { walletAddress },
    include: { settings: true },
  });
}

const VALID_SETTINGS_FIELDS = new Set([
  "darkMode",
  "designTheme",
  "privacyMode",
  "gasPreference",
  "relayer",
  "defaultPair",
  "notifProofVerified",
  "notifOrderMatched",
  "notifVaultActivity",
  "notifSystemUpdates",
]);

export async function updateUserSettings(
  walletAddress: string,
  settings: Record<string, unknown>
) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) throw new Error("User not found");

  // Only allow valid settings fields to be persisted
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (VALID_SETTINGS_FIELDS.has(key)) {
      filtered[key] = value;
    }
  }

  return prisma.userSettings.upsert({
    where: { userId: user.id },
    update: filtered,
    create: { userId: user.id, ...filtered } as any,
  });
}
