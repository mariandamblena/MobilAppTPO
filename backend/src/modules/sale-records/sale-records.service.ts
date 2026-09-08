import { prisma } from "../../lib/prisma";
import { notFound, forbidden, validationError, AppError, ErrorCode } from "../../lib/errors";
import { createNotification } from "../notifications/notifications.service";
import { maybeUpgradeCategory } from "../clients/clients.service";
import { PENALTY_RATE } from "../../lib/constants";
import type { JwtPayload } from "../../lib/jwt";

/** Plazo (ms) para presentar los fondos de una multa: 72 horas. */
const PENALTY_DUE_MS = 72 * 60 * 60 * 1000;

// ── Operaciones ──────────────────────────────────────────────────────────────

export async function getSaleRecordById(id: number, auth: JwtPayload) {
  const saleRecord = await prisma.saleRecord.findUnique({
    where: { id },
    include: {
      product: { include: { photos: { take: 1 } } },
      paymentMethod: true,
    },
  });

  if (!saleRecord) throw notFound("Registro de venta");

  if (!auth.roles.includes("ADMIN") && saleRecord.clientId !== auth.sub) {
    throw forbidden("Solo el comprador puede ver esta compra");
  }

  return saleRecord;
}

export async function getSaleRecords(
  filters: { auctionId?: number; clientId?: number; ownerId?: number },
  auth: JwtPayload
) {
  const where: Record<string, unknown> = {};

  if (auth.roles.includes("ADMIN")) {
    // Admin ve todos, puede filtrar por cualquier campo
    if (filters.auctionId) where.auctionId = filters.auctionId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
  } else {
    // Cliente solo ve sus compras
    where.clientId = auth.sub;
    if (filters.auctionId) where.auctionId = filters.auctionId;
  }

  return prisma.saleRecord.findMany({
    where,
    include: {
      product: { include: { photos: { take: 1 } } },
      paymentMethod: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSaleRecord(data: {
  auctionId: number;
  ownerId: number;
  productId: number;
  clientId: number;
  amount: number;
  commission: number;
  shippingCost?: number;
  pickupInPerson?: boolean;
  paymentMethodId: number;
  boughtByCompany?: boolean;
}) {
  const saleRecord = await prisma.saleRecord.create({
    data: {
      auctionId: data.auctionId,
      ownerId: data.ownerId,
      productId: data.productId,
      clientId: data.clientId,
      amount: data.amount,
      commission: data.commission,
      shippingCost: data.shippingCost ?? null,
      pickupInPerson: data.pickupInPerson ?? false,
      paymentMethodId: data.paymentMethodId,
      boughtByCompany: data.boughtByCompany ?? false,
      paymentStatus: "pending",
    },
  });

  // Actualizar el ítem del catálogo al estado correcto
  const catalogItem = await prisma.catalogItem.findFirst({
    where: { productId: data.productId },
  });

  if (catalogItem) {
    await prisma.catalogItem.update({
      where: { id: catalogItem.id },
      data: {
        status: data.boughtByCompany ? "unsold" : "sold",
        auctioned: true,
      },
    });
  }

  // Notificar al ganador si no es la empresa
  if (!data.boughtByCompany) {
    await createNotification(
      data.clientId,
      "auction_winner",
      "¡Ganaste un ítem!",
      `Felicitaciones, ganaste el ítem por $${data.amount}. Recordá completar el pago.`,
      { saleRecordId: saleRecord.id, amount: data.amount, commission: data.commission, shippingCost: data.shippingCost }
    );
  }

  return saleRecord;
}

export async function updateShipping(
  saleRecordId: number,
  data: { pickupInPerson: boolean; shippingAddress?: string },
  auth: JwtPayload
) {
  const saleRecord = await prisma.saleRecord.findUnique({ where: { id: saleRecordId } });
  if (!saleRecord) throw notFound("Registro de venta");

  if (saleRecord.clientId !== auth.sub) {
    throw forbidden("Solo el comprador puede actualizar el envío");
  }

  // Retiro en persona: no se necesita dirección y se pierde el seguro
  // Envío: la dirección es obligatoria y el seguro se mantiene
  if (data.pickupInPerson) {
    const updated = await prisma.saleRecord.update({
      where: { id: saleRecordId },
      data: {
        pickupInPerson: true,
        shippingAddress: null,
        insuranceCovered: false,
      },
    });
    return updated;
  }

  if (!data.shippingAddress) {
    throw validationError("Si elegís envío, la dirección es requerida", {
      shippingAddress: "Requerida cuando pickupInPerson es false",
    });
  }

  const updated = await prisma.saleRecord.update({
    where: { id: saleRecordId },
    data: {
      pickupInPerson: false,
      shippingAddress: data.shippingAddress,
      insuranceCovered: true,
    },
  });

  return updated;
}

export async function paySaleRecord(
  saleRecordId: number,
  data: { paymentMethodId: number },
  auth: JwtPayload
) {
  const saleRecord = await prisma.saleRecord.findUnique({
    where: { id: saleRecordId },
    include: { auction: { select: { currency: true } } },
  });
  if (!saleRecord) throw notFound("Registro de venta");

  // Guard: una compra ya pagada no puede volver a pagarse (evita doble cobro
  // y reprocesos).
  if (saleRecord.paymentStatus === "paid") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, "La compra ya fue pagada");
  }

  if (saleRecord.clientId !== auth.sub) {
    throw forbidden("Solo el comprador puede pagar");
  }

  // Verificar que el medio de pago pertenece al cliente
  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { id: data.paymentMethodId },
  });

  if (!paymentMethod || paymentMethod.clientId !== auth.sub) {
    throw new AppError(ErrorCode.PAYMENT_METHOD_NOT_OWNED, 403, "Ese medio de pago no te pertenece");
  }

  // Verificar que el medio está verificado
  if (paymentMethod.status !== "verified") {
    throw new AppError(ErrorCode.NO_VERIFIED_PAYMENT_METHOD, 403, "El medio de pago no está verificado");
  }

  // Validar moneda: el medio de pago debe coincidir con la moneda de la subasta
  const auctionCurrency = saleRecord.auction?.currency;
  if (auctionCurrency && paymentMethod.currency !== auctionCurrency) {
    throw new AppError(
      ErrorCode.CURRENCY_MISMATCH,
      422,
      `El medio de pago debe ser en la moneda de la subasta (${auctionCurrency}).`
    );
  }

  // Si es cheque certificado, verificar que el monto no supere el reservado
  if (paymentMethod.type === "certified_check") {
    if (saleRecord.amount > (paymentMethod.reservedAmount ?? 0)) {
      return await handlePaymentFailure({ ...saleRecord, clientId: auth.sub, productId: saleRecord.productId }, auth.sub);
    }
  }

  // En dev: simular pago exitoso si el medio está verificado
  const updated = await prisma.saleRecord.update({
    where: { id: saleRecordId },
    data: {
      paymentStatus: "paid",
      paidAt: new Date(),
      paymentMethodId: data.paymentMethodId,
    },
  });

  // Mejora de categoría: best-effort, no debe fallar el pago
  if (updated.clientId !== null) {
    maybeUpgradeCategory(updated.clientId).catch((err) => {
      // best-effort: no propagamos, pero dejamos rastro para diagnóstico
      console.error("maybeUpgradeCategory falló tras paySaleRecord", err);
    });
  }

  return updated;
}

async function handlePaymentFailure(saleRecord: { id: number; clientId: number; amount: number; auctionId: number; productId: number }, clientId: number) {
  // Marcar el pago como fallido
  await prisma.saleRecord.update({
    where: { id: saleRecord.id },
    data: { paymentStatus: "failed" },
  });

  // Crear multa del 10%
  const penaltyAmount = saleRecord.amount * PENALTY_RATE;

  // Buscar el catalogItem correspondiente al producto DENTRO del catálogo de
  // esta subasta (Catalog.auctionId es @unique). Un SaleRecord siempre proviene
  // de un ítem subastado, así que el lookup debe resolver; si no, es un problema
  // de integridad y preferimos fallar antes que escribir un itemId inválido (0).
  const catalogItem = await prisma.catalogItem.findFirst({
    where: {
      productId: saleRecord.productId,
      catalog: { auctionId: saleRecord.auctionId },
    },
    select: { id: true },
  });

  if (!catalogItem) {
    throw notFound("Ítem de catálogo para la multa");
  }

  // dueAt: plazo de 72hs para presentar los fondos (consistente con penalties.service).
  const dueAt = new Date(Date.now() + PENALTY_DUE_MS);

  const penalty = await prisma.penalty.create({
    data: {
      clientId: saleRecord.clientId,
      auctionId: saleRecord.auctionId,
      itemId: catalogItem.id,
      amount: penaltyAmount,
      status: "pending",
      dueAt,
    },
  });

  // Bloquear cliente
  await prisma.client.update({
    where: { id: clientId },
    data: { blocked: true },
  });

  // Notificar al cliente
  await createNotification(
    saleRecord.clientId,
    "penalty",
    "Multa generada",
    "No se pudo pagar la compra; se generó una multa del 10%. Tu cuenta quedó bloqueada hasta abonarla.",
    { penaltyAmount }
  );

  throw new AppError(ErrorCode.INSUFFICIENT_FUNDS, 422, "Fondos insuficientes", {
    penaltyAmount,
    penaltyId: penalty.id,
  });
}
