import { PrismaClient } from "@prisma/client";

// Prisma client singleton
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export default prisma;
