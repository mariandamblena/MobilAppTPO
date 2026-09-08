/**
 * Servicio del módulo countries.
 * Lista todos los países ordenados por nombre.
 */

import { prisma } from "../../lib/prisma";

/** Retorna todos los países ordenados alfabéticamente por nombre. */
export async function listCountries() {
  return prisma.country.findMany({
    orderBy: { name: "asc" },
  });
}
