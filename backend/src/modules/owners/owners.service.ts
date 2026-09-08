/**
 * Servicio del módulo owners.
 * CRUD de propietarios/consignantes.
 */

import { prisma } from "../../lib/prisma";
import { notFound, duplicateEntry } from "../../lib/errors";

export interface CreateOwnerInput {
  document: string;
  name: string;
  address?: string;
  countryId?: number;
  financialVerification?: boolean;
  judicialVerification?: boolean;
  riskRating?: number;
  verifierId: number;
}

/** Lista todos los owners. Solo ADMIN. */
export async function listOwners() {
  return prisma.owner.findMany({
    orderBy: { id: "asc" },
  });
}

/** Crea un owner. Lanza DUPLICATE_ENTRY si el documento ya existe. */
export async function createOwner(input: CreateOwnerInput) {
  const existing = await prisma.owner.findUnique({
    where: { document: input.document },
  });

  if (existing) {
    throw duplicateEntry("El documento ya está registrado para otro dueño");
  }

  return prisma.owner.create({
    data: {
      document: input.document,
      name: input.name,
      address: input.address ?? null,
      countryId: input.countryId ?? null,
      financialVerification: input.financialVerification ?? false,
      judicialVerification: input.judicialVerification ?? false,
      riskRating: input.riskRating ?? 1,
      verifierId: input.verifierId,
    },
  });
}

/** Obtiene un owner por ID. Lanza NOT_FOUND si no existe. */
export async function getOwner(ownerId: number) {
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
  });

  if (!owner) {
    throw notFound("Dueño");
  }

  return owner;
}
