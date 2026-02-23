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
            { assetSymbol: "ETH", publicBalance: 0, shieldedBalance: 0, lockedBalance: 0 },
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

export async function updateUserSettings(
  walletAddress: string,
  settings: Record<string, unknown>
) {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) throw new Error("User not found");

  return prisma.userSettings.upsert({
    where: { userId: user.id },
    update: settings,
    create: { userId: user.id, ...settings } as any,
  });
}
