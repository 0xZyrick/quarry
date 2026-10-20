/**
 * Shared Prisma client for server code.
 * One instance per process (avoids exhausting connections on serverless warm starts).
 */
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __quarryPrisma?: PrismaClient };

export const prisma: PrismaClient =
  g.__quarryPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  g.__quarryPrisma = prisma;
}
