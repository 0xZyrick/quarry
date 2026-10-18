import { PrismaClient } from "@prisma/client";

// One shared PrismaClient for the whole app.
// In dev, Next.js hot-reloads modules, so we cache the client on globalThis
// to avoid opening a new connection pool on every reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
