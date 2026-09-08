/**
 * Servicio de medios de pago — lógica de negocio.
 *
 * listByClient  — lista los medios del cliente del token
 * create        — crea un medio con status "pending"
 * remove        — elimina un medio propio (ownership check)
 * verify        — ADMIN: aprueba o rechaza un medio
 */

import { prisma } from "../../lib/prisma";
import { notFound, forbidden } from "../../lib/errors";
import type { CreatePaymentMethodInput, VerifyPaymentMethodInput } from "./paymentMethods.schema";
import { maybeUpgradeCategory } from "../clients/clients.service";

// ── listByClient ─────────────────────────────────────────────────────────────

/**
 * Devuelve todos los medios de pago del cliente.
 * El clientId viene del JWT (req.auth.sub), nunca del body.
 */
export async function listByClient(clientId: number) {
  return prisma.paymentMethod.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });
}

// ── create ───────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo medio de pago con status "pending".
 * El clientId se toma del JWT; jamás del body (ver ADR-003-jwt-identity).
 */
export async function create(clientId: number, data: CreatePaymentMethodInput) {
  return prisma.paymentMethod.create({
    data: {
      clientId,
      type: data.type,
      currency: data.currency,
      detail: data.detail,
      bank: data.bank ?? null,
      countryId: data.countryId ?? null,
      reservedAmount: data.reservedAmount ?? null,
      status: "pending",
    },
  });
}

// ── remove ───────────────────────────────────────────────────────────────────

/**
 * Elimina un medio de pago.
 * - 404 si no existe.
 * - 403 si el medio no pertenece al cliente autenticado.
 */
export async function remove(id: number, clientId: number) {
  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { id },
  });

  if (!paymentMethod) {
    throw notFound("Medio de pago");
  }

  if (paymentMethod.clientId !== clientId) {
    throw forbidden("No podés eliminar un medio de pago que no es tuyo");
  }

  await prisma.paymentMethod.delete({ where: { id } });
}

// ── verify ───────────────────────────────────────────────────────────────────

/**
 * Verifica o rechaza un medio de pago (solo ADMIN).
 * Si status=rejected se guarda rejectionReason.
 * - 404 si no existe el medio.
 */
export async function verify(id: number, data: VerifyPaymentMethodInput) {
  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { id },
  });

  if (!paymentMethod) {
    throw notFound("Medio de pago");
  }

  const updated = await prisma.paymentMethod.update({
    where: { id },
    data: {
      status: data.status,
      // Solo persistir rejectionReason cuando se rechaza; limpiar si se verifica
      rejectionReason: data.status === "rejected" ? (data.reason ?? null) : null,
    },
  });

  // Consigna: la diversidad de medios verificados puede mejorar la categoría del cliente.
  // Se ejecuta best-effort (maybeUpgradeCategory atrapa sus propios errores).
  if (data.status === "verified") {
    await maybeUpgradeCategory(paymentMethod.clientId);
  }

  return updated;
}
