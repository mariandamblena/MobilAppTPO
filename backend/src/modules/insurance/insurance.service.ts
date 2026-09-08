import { prisma } from "../../lib/prisma";
import { notFound, forbidden, validationError, AppError, ErrorCode } from "../../lib/errors";
import type { JwtPayload } from "../../lib/jwt";

/**
 * Resuelve el Owner del cliente autenticado a partir de su DNI.
 *
 * IMPORTANTE: `auth.sub` es `Client.id`, NO `Owner.id` (son espacios de IDs
 * distintos). El Owner se vincula al Client por `document`. Comparar `auth.sub`
 * contra un `ownerId` era un bug de autorización (IDOR). Devuelve null si el
 * cliente todavía no es dueño de ningún bien.
 */
async function resolveOwnerId(auth: JwtPayload): Promise<number | null> {
  const client = await prisma.client.findUnique({
    where: { id: auth.sub },
    select: { document: true },
  });
  if (!client) return null;

  const owner = await prisma.owner.findUnique({
    where: { document: client.document },
    select: { id: true },
  });
  return owner?.id ?? null;
}

async function checkOwnerHasPolicy(ownerId: number | null, policyNumber: string) {
  if (ownerId === null) {
    throw new AppError(ErrorCode.FORBIDDEN, 403, "No tenés ningún bien con esa póliza");
  }
  const product = await prisma.product.findFirst({
    where: { ownerId, insurancePolicy: policyNumber },
  });
  if (!product) {
    throw new AppError(ErrorCode.FORBIDDEN, 403, "No tenés ningún bien con esa póliza");
  }
}

export async function getInsurance(policyNumber: string, auth: JwtPayload) {
  const insurance = await prisma.insurance.findUnique({
    where: { policyNumber },
  });

  if (!insurance) throw notFound("Póliza");

  if (!auth.roles.includes("ADMIN")) {
    await checkOwnerHasPolicy(await resolveOwnerId(auth), policyNumber);
  }

  return insurance;
}

export async function increaseCoverage(
  policyNumber: string,
  data: { newAmount: number },
  auth: JwtPayload
) {
  const insurance = await prisma.insurance.findUnique({
    where: { policyNumber },
  });

  if (!insurance) throw notFound("Póliza");

  if (!auth.roles.includes("ADMIN")) {
    await checkOwnerHasPolicy(await resolveOwnerId(auth), policyNumber);
  }

  if (data.newAmount <= insurance.amount) {
    throw validationError("El nuevo monto debe ser mayor al actual", {
      newAmount: `Debe ser mayor a ${insurance.amount}`,
    });
  }

  const premiumDelta = (data.newAmount - insurance.amount) * 0.02;
  const previousAmount = insurance.amount;

  await prisma.insurance.update({
    where: { policyNumber },
    data: { amount: data.newAmount },
  });

  return {
    policyNumber,
    previousAmount,
    newAmount: data.newAmount,
    premiumDelta,
    status: "confirmed",
  };
}

export async function getProductLocation(productId: number, auth: JwtPayload) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound("Producto");

  if (!auth.roles.includes("ADMIN")) {
    const ownerId = await resolveOwnerId(auth);
    if (ownerId === null || product.ownerId !== ownerId) {
      throw forbidden("No tenés acceso a la ubicación de este producto");
    }
  }

  const location = await prisma.productLocation.findUnique({
    where: { productId },
  });

  if (!location) throw notFound("Ubicación del producto");

  return location;
}

export async function getPayoutAccounts(ownerId: number, auth: JwtPayload) {
  if (!auth.roles.includes("ADMIN")) {
    const myOwnerId = await resolveOwnerId(auth);
    if (myOwnerId === null || myOwnerId !== ownerId) {
      throw forbidden("Solo podés ver tus propias cuentas de cobro");
    }
  }

  return prisma.payoutAccount.findMany({ where: { ownerId } });
}

export async function createPayoutAccount(
  ownerId: number,
  data: {
    bank: string;
    currency: string;
    cbuOrIban: string;
    accountHolder: string;
    countryId?: number;
  },
  auth: JwtPayload
) {
  if (!auth.roles.includes("ADMIN")) {
    const myOwnerId = await resolveOwnerId(auth);
    if (myOwnerId === null || myOwnerId !== ownerId) {
      throw forbidden("Solo podés declarar tus propias cuentas de cobro");
    }
  }

  return prisma.payoutAccount.create({
    data: {
      ownerId,
      bank: data.bank,
      currency: data.currency,
      cbuOrIban: data.cbuOrIban,
      accountHolder: data.accountHolder,
      countryId: data.countryId ?? null,
      declaredAt: new Date(),
    },
  });
}
