import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Minimal seed  no demo data. The database starts clean.
 * Users are created when they connect via MetaMask.
 */
async function main() {
  console.log("Clearing all existing data...");

  // Delete in dependency order
  await prisma.complianceViewingKey.deleteMany();
  await prisma.settlementTx.deleteMany();
  await prisma.proof.deleteMany();
  await prisma.match.deleteMany();
  await prisma.orderCommitment.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.analyticsSnapshot.deleteMany();
  await prisma.vaultBalance.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();

  console.log("Database is clean  no seed data. Connect with MetaMask to get started.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
