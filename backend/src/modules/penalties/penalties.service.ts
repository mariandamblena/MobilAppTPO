/**
 * Servicio de multas — lógica de negocio.
 *
 * create        — crea Penalty status=pending y bloquea al cliente
 * listByClient  — lista las multas de un cliente (historial completo)
 * pay           — marca la multa como pagada; desbloquea al cliente si no quedan pendientes
 */

import { prisma } from "../../lib/prisma";
import { notFound, forbidden, validationError } from "../../lib/errors";
import { createNotification } from "../notifications/notifications.service";
import type { CreatePenaltyInput } from "./penalties.schema";

// ── create ────────────────────────────────────────────────────────────────────

/**
 * Crea una Penalty con status "pending" y bloquea al cliente.
 * Normalmente invocado desde el service de F07 al detectar INSUFFICIENT_FUNDS.
 * El amount lo calcula el llamador (10% del SaleRecord.amount).
 *
 * Operaciones atómicas en una transacción:
 *  1. Crear Penalty { status: 'pending' }
 *  2. Setear Client.blocked = true
 */
export async function create(data: CreatePenaltyInput) {
  const penalty = await prisma.$transaction(async (tx) => {
    // Consigna: el cliente deberá presentar los fondos antes de las 72hs.
    // Si dueAt < now y status sigue 'pending' → el cliente permanece bloqueado;
    // casos vencidos sin pago se derivan a instancia judicial (derivación en
    // lectura: ningún scheduler, se evalúa al consultar la multa).
    const dueAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Crear la multa
    const created = await tx.penalty.create({
      data: {
        clientId: data.clientId,
        auctionId: data.auctionId,
        itemId: data.itemId,
        amount: data.amount,
        status: "pending",
        dueAt,
      },
    });

    // Bloquear al cliente
    await tx.client.update({
      where: { id: data.clientId },
      data: { blocked: true },
    });

    return created;
  });

  // Notificar al cliente (fuera de la transacción para no bloquear)
  await createNotification(
    data.clientId,
    "penalty",
    "Multa generada",
    `Se generó una multa de $${data.amount}.`,
    { penaltyId: penalty.id }
  );

  return penalty;
}

// ── listByClient ──────────────────────────────────────────────────────────────

/**
 * Devuelve el historial completo de multas de un cliente (pending + paid),
 * ordenadas por createdAt descendente (las más recientes primero).
 */
export async function listByClient(clientId: number) {
  return prisma.penalty.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });
}

// ── pay ───────────────────────────────────────────────────────────────────────

export interface PayResult {
  penalty: {
    id: number;
    clientId: number;
    auctionId: number;
    itemId: number;
    amount: number;
    status: string;
    dueAt: Date | null;
    createdAt: Date;
    paidAt: Date | null;
  };
  /** true si el cliente no tiene más multas pendientes y fue desbloqueado. */
  clientUnblocked: boolean;
}

/**
 * Paga una multa.
 * - Solo el cliente dueño de la multa o un ADMIN pueden pagarla.
 * - Si ya está pagada → 400 VALIDATION_ERROR.
 * - Si no existe → 404 RESOURCE_NOT_FOUND.
 * - Si no es el dueño ni admin → 403 FORBIDDEN.
 *
 * Flujo:
 *  1. Marcar status = 'paid', paidAt = now
 *  2. Contar multas pending del cliente: si count === 0 → Client.blocked = false
 *
 * @param id                 ID de la multa a pagar
 * @param requestingClientId clientId del usuario que hace la petición (req.auth.sub)
 * @param isAdmin            true si el usuario tiene rol ADMIN
 */
export async function pay(
  id: number,
  requestingClientId: number,
  isAdmin: boolean
): Promise<PayResult> {
  // Buscar la multa
  const penalty = await prisma.penalty.findUnique({
    where: { id },
  });

  if (!penalty) {
    throw notFound("Multa");
  }

  // Solo el propietario o un admin puede pagar
  if (penalty.clientId !== requestingClientId && !isAdmin) {
    throw forbidden("Solo podés pagar tus propias multas");
  }

  // No se puede pagar dos veces
  if (penalty.status === "paid") {
    throw validationError("La multa ya estaba pagada", { status: "Ya tiene estado 'paid'" });
  }

  // Pagar y evaluar desbloqueo en una transacción atómica
  return prisma.$transaction(async (tx) => {
    // Marcar como pagada
    const updated = await tx.penalty.update({
      where: { id },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
    });

    // Contar multas pendientes del cliente (excluye la que acabamos de pagar)
    const pendingCount = await tx.penalty.count({
      where: {
        clientId: penalty.clientId,
        status: "pending",
      },
    });

    let clientUnblocked = false;

    if (pendingCount === 0) {
      // No quedan pendientes → desbloquear al cliente
      await tx.client.update({
        where: { id: penalty.clientId },
        data: { blocked: false },
      });
      clientUnblocked = true;
    }

    return { penalty: updated, clientUnblocked };
  });
}
