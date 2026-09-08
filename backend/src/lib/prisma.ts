/**
 * Singleton de PrismaClient.
 * Se exporta una única instancia para evitar conexiones múltiples.
 */

import { PrismaClient } from "@prisma/client";

// En desarrollo, se reutiliza la instancia entre hot-reloads de tsx
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
