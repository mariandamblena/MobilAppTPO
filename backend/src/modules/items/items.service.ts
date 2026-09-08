/**
 * Servicio de ítems y pujas.
 *
 * La lógica de concurrencia usa una transacción + recompute del bestBid
 * dentro de la transacción para serializar las pujas (BEGIN IMMEDIATE en SQLite).
 */

import { prisma } from "../../lib/prisma";
import { AppError, ErrorCode, notFound } from "../../lib/errors";
import { computeRange } from "../auctions/auctions.service";

// ── GET /items ────────────────────────────────────────────────────────────────

export interface ListItemsFilters {
  catalogId?: number;
  /** Si se pasa auctionId, se resuelve el catalogId de la subasta. */
  auctionId?: number;
  auctioned?: boolean;
}

function mapItem(
  item: {
    id: number;
    catalogId: number;
    productId: number;
    lotNumber: number;
    basePrice: number;
    commission: number;
    status: string;
    auctioned: boolean;
  },
  isAuthenticated: boolean
) {
  return {
    id: item.id,
    catalogId: item.catalogId,
    productId: item.productId,
    lotNumber: item.lotNumber,
    basePrice: isAuthenticated ? item.basePrice : null,
    commission: item.commission,
    status: item.status,
    auctioned: item.auctioned,
  };
}

export async function listItems(
  filters: ListItemsFilters,
  isAuthenticated: boolean
) {
  let resolvedCatalogId = filters.catalogId;

  if (filters.auctionId && !resolvedCatalogId) {
    const catalog = await prisma.catalog.findFirst({
      where: { auctionId: filters.auctionId },
      select: { id: true },
    });
    if (!catalog) return [];
    resolvedCatalogId = catalog.id;
  }

  const where: Record<string, unknown> = {};
  if (resolvedCatalogId) where.catalogId = resolvedCatalogId;
  if (filters.auctioned !== undefined) where.auctioned = filters.auctioned;

  const items = await prisma.catalogItem.findMany({
    where,
    orderBy: { lotNumber: "asc" },
  });

  return items.map((item) => mapItem(item, isAuthenticated));
}

// ── GET /items/:id ─────────────────────────────────────────────────────────────

export async function getItemDetail(itemId: number, isAuthenticated: boolean) {
  const item = await prisma.catalogItem.findUnique({
    where: { id: itemId },
    include: {
      product: true,
      catalog: {
        include: { auction: { select: { id: true, category: true, status: true } } },
      },
    },
  });

  if (!item) throw notFound("Ítem");

  const [bestBidRow, lastBidRow] = await Promise.all([
    prisma.bid.findFirst({
      where: { itemId },
      orderBy: { amount: "desc" },
      select: { amount: true },
    }),
    prisma.bid.findFirst({
      where: { itemId },
      orderBy: { timestamp: "desc" },
      select: { amount: true },
    }),
  ]);

  const bestBid = bestBidRow?.amount ?? null;
  const lastBidAmount = lastBidRow?.amount ?? null;

  const { minBidAllowed, maxBidAllowed } = computeRange(
    item,
    item.catalog.auction.category,
    bestBid,
    lastBidAmount
  );

  return {
    ...mapItem(item, isAuthenticated),
    auctionId: item.catalog.auction.id,
    auctionStatus: item.catalog.auction.status,
    productDetail: {
      id: item.product.id,
      catalogDescription: item.product.catalogDescription,
      fullDescription: item.product.fullDescription,
      artist: item.product.artist,
      historicalDate: item.product.historicalDate,
      history: item.product.history,
      pieceCount: item.product.pieceCount,
    },
    bestBid: isAuthenticated ? bestBid : null,
    minBidAllowed: isAuthenticated ? minBidAllowed : null,
    maxBidAllowed: isAuthenticated ? maxBidAllowed : null,
  };
}

// ── POST /items (admin) ───────────────────────────────────────────────────────

export async function createItem(data: {
  catalogId: number;
  productId: number;
  lotNumber: number;
  basePrice: number;
  commission: number;
  status?: string;
}) {
  return prisma.catalogItem.create({
    data: {
      catalogId: data.catalogId,
      productId: data.productId,
      lotNumber: data.lotNumber,
      basePrice: data.basePrice,
      commission: data.commission,
      status: data.status ?? "pending",
      auctioned: false,
    },
  });
}

// ── PATCH /items/:id (admin) ──────────────────────────────────────────────────

export async function updateItem(
  id: number,
  data: {
    lotNumber?: number;
    basePrice?: number;
    commission?: number;
    status?: string;
    auctioned?: boolean;
    insurancePolicy?: string | null;
  }
) {
  const existing = await prisma.catalogItem.findUnique({ where: { id } });
  if (!existing) throw notFound("Ítem");

  return prisma.catalogItem.update({
    where: { id },
    data: {
      ...(data.lotNumber !== undefined && { lotNumber: data.lotNumber }),
      ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
      ...(data.commission !== undefined && { commission: data.commission }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.auctioned !== undefined && { auctioned: data.auctioned }),
      ...(data.insurancePolicy !== undefined && { insurancePolicy: data.insurancePolicy }),
    },
  });
}

// ── GET /items/:id/bids ───────────────────────────────────────────────────────

export async function listBids(itemId: number) {
  const item = await prisma.catalogItem.findUnique({ where: { id: itemId } });
  if (!item) throw notFound("Ítem");

  const bids = await prisma.bid.findMany({
    where: { itemId },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    include: {
      attendee: { select: { bidderNumber: true } },
    },
  });

  return bids.map((bid) => ({
    id: bid.id,
    attendeeId: bid.attendeeId,
    bidderNumber: bid.attendee.bidderNumber,
    itemId: bid.itemId,
    amount: bid.amount,
    winner: bid.winner,
    timestamp: bid.timestamp.toISOString(),
    paymentMethodId: bid.paymentMethodId,
  }));
}

// ── POST /items/:id/bids ──────────────────────────────────────────────────────

export interface CreateBidInput {
  itemId: number;
  clientId: number;
  amount: number;
  paymentMethodId: number;
  idempotencyKey: string;
  knownBestBid?: number | null;
}

/**
 * Registra una nueva puja.
 *
 * Flujo (dentro de una transacción):
 *   1. Idempotencia: si la clave ya existe, devolver la puja existente.
 *   2. Resolver attendee por (auctionId del ítem + clientId); verificar sesión activa.
 *   3. Validar paymentMethod (propiedad, verificado, límite de cheque, no bloqueado).
 *   4. Recomputar bestBid / lastBid DENTRO de la transacción.
 *   5. BID_SUPERSEDED si el bestBid cambió vs. lo que el cliente conocía.
 *   6. Validar rango (salvo gold/platinum).
 *   7. Insertar Bid, marcar winner, crear AuctionEvent, incrementar auction.version.
 *   8. Retornar 201 con la Bid.
 */
export async function createBid(input: CreateBidInput) {
  return prisma.$transaction(async (tx) => {
    // 1. Idempotencia
    const existing = await tx.bid.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    const item = await tx.catalogItem.findUnique({
      where: { id: input.itemId },
      include: {
        catalog: {
          include: {
            auction: {
              select: {
                id: true,
                category: true,
                currency: true,
                version: true,
                currentItemId: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!item) throw notFound("Ítem");

    const auction = item.catalog.auction;
    const auctionId = auction.id;

    // 2. Resolver attendee y verificar sesión activa
    const attendee = await tx.attendee.findUnique({
      where: { auctionId_clientId: { auctionId, clientId: input.clientId } },
    });

    if (!attendee) {
      throw new AppError(ErrorCode.NOT_CONNECTED, 403, "No estás conectado a esta subasta");
    }

    const activeSession = await tx.auctionSession.findFirst({
      where: { auctionId, clientId: input.clientId, active: true },
    });
    if (!activeSession) {
      throw new AppError(ErrorCode.NOT_CONNECTED, 403, "No estás conectado a esta subasta");
    }

    // 3. Validar medio de pago
    const paymentMethod = await tx.paymentMethod.findUnique({
      where: { id: input.paymentMethodId },
    });

    if (!paymentMethod || paymentMethod.clientId !== input.clientId) {
      throw new AppError(ErrorCode.PAYMENT_METHOD_NOT_OWNED, 403, "El medio de pago no te pertenece");
    }
    if (paymentMethod.status !== "verified") {
      throw new AppError(ErrorCode.NO_VERIFIED_PAYMENT_METHOD, 403, "El medio de pago no está verificado");
    }

    const client = await tx.client.findUnique({ where: { id: input.clientId } });
    if (!client || client.blocked) {
      throw new AppError(ErrorCode.CLIENT_BLOCKED, 403, "La cuenta está bloqueada");
    }

    if (paymentMethod.type === "certified_check") {
      const reservedAmount = paymentMethod.reservedAmount ?? 0;
      const committed = await tx.bid.aggregate({
        where: {
          attendee: { clientId: input.clientId },
          winner: true,
          paymentMethodId: input.paymentMethodId,
        },
        _sum: { amount: true },
      });
      const totalCommitted = (committed._sum.amount ?? 0) + input.amount;
      if (totalCommitted > reservedAmount) {
        throw new AppError(
          ErrorCode.CHECK_LIMIT_EXCEEDED,
          403,
          `Superás el límite del cheque (${reservedAmount}). Comprometido: ${committed._sum.amount ?? 0}`
        );
      }
    }

    // 3b. Validar moneda: el medio de pago debe coincidir con la moneda de la subasta
    if (paymentMethod.currency !== auction.currency) {
      throw new AppError(
        ErrorCode.CURRENCY_MISMATCH,
        422,
        `El medio de pago debe ser en la moneda de la subasta (${auction.currency}).`
      );
    }

    // 4. Recomputar bestBid y lastBid DENTRO de la transacción
    const bestBidRow = await tx.bid.findFirst({
      where: { itemId: input.itemId },
      orderBy: { amount: "desc" },
      select: { amount: true },
    });
    const lastBidRow = await tx.bid.findFirst({
      where: { itemId: input.itemId },
      orderBy: { timestamp: "desc" },
      select: { amount: true },
    });

    const currentBest = bestBidRow?.amount ?? null;
    const lastBidAmount = lastBidRow?.amount ?? null;

    // 5. BID_SUPERSEDED: el best cambió vs. lo que el cliente conocía
    if (
      input.knownBestBid !== undefined &&
      input.knownBestBid !== null &&
      currentBest !== null &&
      currentBest !== input.knownBestBid
    ) {
      throw new AppError(
        ErrorCode.BID_SUPERSEDED,
        409,
        "Otro postor pujó antes que vos. Refrescá el estado y volvé a intentar."
      );
    }

    // 6. Validar rango (excepto gold/platinum)
    const { minBidAllowed, maxBidAllowed } = computeRange(
      item,
      auction.category,
      currentBest,
      lastBidAmount
    );

    if (minBidAllowed !== null && input.amount < minBidAllowed) {
      throw new AppError(
        ErrorCode.BID_OUT_OF_RANGE,
        422,
        `El importe mínimo permitido es ${minBidAllowed}`,
        { minAllowed: minBidAllowed, maxAllowed: maxBidAllowed }
      );
    }
    if (maxBidAllowed !== null && input.amount > maxBidAllowed) {
      throw new AppError(
        ErrorCode.BID_OUT_OF_RANGE,
        422,
        `El importe máximo permitido es ${maxBidAllowed}`,
        { minAllowed: minBidAllowed, maxAllowed: maxBidAllowed }
      );
    }

    if (minBidAllowed === null) {
      const threshold = currentBest !== null ? currentBest : item.basePrice;
      if (input.amount <= threshold - 0.001) {
        throw new AppError(
          ErrorCode.BID_OUT_OF_RANGE,
          422,
          `El importe debe superar la mejor puja actual (${threshold})`,
          { minAllowed: threshold, maxAllowed: null }
        );
      }
    }

    // 7. Insertar puja, marcar ganador, crear evento, incrementar versión

    await tx.bid.updateMany({
      where: { itemId: input.itemId, winner: true },
      data: { winner: false },
    });

    const newBid = await tx.bid.create({
      data: {
        itemId: input.itemId,
        attendeeId: attendee.id,
        amount: input.amount,
        winner: true,
        paymentMethodId: input.paymentMethodId,
        idempotencyKey: input.idempotencyKey,
        timestamp: new Date(),
      },
    });

    await tx.auctionEvent.create({
      data: {
        auctionId,
        type: "new_bid",
        data: JSON.stringify({
          bidId: newBid.id,
          itemId: input.itemId,
          amount: input.amount,
          attendeeId: attendee.id,
          bidderNumber: attendee.bidderNumber,
        }),
        createdAt: new Date(),
      },
    });

    await tx.auction.update({
      where: { id: auctionId },
      data: { version: { increment: 1 } },
    });

    return newBid;
  });
}

// ── GET /me/bids ────────────────────────────────────────────────────────────────

/** Lista las pujas del cliente actual (vía sus attendees), más recientes primero. */
export async function listMyBids(clientId: number) {
  const bids = await prisma.bid.findMany({
    where: { attendee: { clientId } },
    orderBy: { timestamp: "desc" },
    include: {
      item: {
        include: {
          product: { include: { photos: { take: 1 } } },
          catalog: {
            include: { auction: { select: { id: true, currency: true, status: true } } },
          },
        },
      },
    },
  });

  return bids.map((bid) => ({
    id: bid.id,
    itemId: bid.itemId,
    amount: bid.amount,
    winner: bid.winner,
    timestamp: bid.timestamp.toISOString(),
    lotNumber: bid.item.lotNumber,
    title: bid.item.product.catalogDescription ?? bid.item.product.fullDescription,
    photo: bid.item.product.photos[0]?.photoUrl ?? null,
    auctionId: bid.item.catalog.auctionId,
    auctionStatus: bid.item.catalog.auction.status,
    currency: bid.item.catalog.auction.currency,
  }));
}
