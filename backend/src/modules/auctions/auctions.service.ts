/**
 * Servicio de subastas, catálogo y sesiones en vivo.
 *
 * Exporta computeRange() para reutilizarlo en items/bids.
 */

import { prisma } from "../../lib/prisma";
import { AppError, ErrorCode, notFound } from "../../lib/errors";
import { createNotification } from "../notifications/notifications.service";

// ── Constantes de categoría ─────────────────────────────────────────────────

const CATEGORY_ORDER = ["common", "special", "silver", "gold", "platinum"] as const;
type Category = (typeof CATEGORY_ORDER)[number];

const EXEMPT_CATEGORIES: string[] = ["gold", "platinum"];

// ── Helper de rango de puja ─────────────────────────────────────────────────

export interface BidRange {
  minBidAllowed: number | null;
  maxBidAllowed: number | null;
}

/**
 * Calcula el rango [min, max] permitido para la próxima puja.
 *
 * Reglas (F05):
 *   - base = item.basePrice
 *   - Primera puja: minBidAllowed = base
 *   - Con pujas previas: minBidAllowed = bestBid + 0.01 * base
 *   - maxBidAllowed = max(bestBid, lastBidAmount) + 0.20 * base
 *     (solo si hay pujas previas)
 *   - Si auction.category ∈ {gold, platinum} → min/max = null (sin límites)
 */
export function computeRange(
  item: { basePrice: number },
  auctionCategory: string,
  bestBid: number | null,
  lastBidAmount: number | null
): BidRange {
  if (EXEMPT_CATEGORIES.includes(auctionCategory)) {
    return { minBidAllowed: null, maxBidAllowed: null };
  }

  const base = item.basePrice;

  const minBidAllowed =
    bestBid !== null
      ? bestBid + 0.01 * base
      : base;

  const maxBidReference =
    bestBid !== null ? Math.max(bestBid, lastBidAmount ?? bestBid) : lastBidAmount;
  const maxBidAllowed =
    maxBidReference !== null
      ? maxBidReference + 0.2 * base
      : null;

  return { minBidAllowed, maxBidAllowed };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isCategorySufficient(
  auctionCategory: string,
  clientCategory: string | null
): boolean {
  const aIdx = CATEGORY_ORDER.indexOf(auctionCategory as Category);
  const cIdx = CATEGORY_ORDER.indexOf(clientCategory as Category);
  if (aIdx === -1 || cIdx === -1) return false;
  return aIdx <= cIdx;
}

function mapAuction(a: {
  id: number;
  startsAt: Date;
  status: string;
  currency: string;
  category: string;
  auctioneerId: number | null;
  location: string | null;
  attendeeCapacity: number | null;
  hasWarehouse: boolean;
  ownSecurity: boolean;
  streamingUrl: string | null;
  isCollection: boolean;
  collectionName: string | null;
}) {
  return {
    id: a.id,
    startsAt: a.startsAt.toISOString(),
    status: a.status,
    currency: a.currency,
    category: a.category,
    auctioneerId: a.auctioneerId,
    location: a.location,
    attendeeCapacity: a.attendeeCapacity,
    hasWarehouse: a.hasWarehouse,
    ownSecurity: a.ownSecurity,
    streamingUrl: a.streamingUrl,
    isCollection: a.isCollection,
    collectionName: a.collectionName,
  };
}

// ── GET /auctions ────────────────────────────────────────────────────────────

export interface ListAuctionsFilters {
  status?: string;
  category?: string;
  currency?: string;
  date?: string;
}

export async function listAuctions(filters: ListAuctionsFilters) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.currency) where.currency = filters.currency;
  if (filters.date) {
    const day = new Date(filters.date);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    where.startsAt = { gte: day, lt: nextDay };
  }

  const auctions = await prisma.auction.findMany({ where, orderBy: { startsAt: "asc" } });
  return auctions.map(mapAuction);
}

// ── GET /auctions/:id ────────────────────────────────────────────────────────

export async function getAuctionDetail(auctionId: number) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      catalog: {
        include: { items: { select: { id: true } } },
      },
      attendees: { select: { id: true } },
    },
  });

  if (!auction) throw notFound("Subasta");

  return {
    ...mapAuction(auction),
    catalogId: auction.catalog?.id ?? null,
    itemCount: auction.catalog?.items.length ?? 0,
    attendeeCount: auction.attendees.length,
  };
}

// ── POST /auctions (admin) ────────────────────────────────────────────────────

export async function createAuction(data: {
  startsAt: string;
  status?: string;
  currency: string;
  category: string;
  auctioneerId?: number;
  location?: string;
  attendeeCapacity?: number;
  hasWarehouse?: boolean;
  ownSecurity?: boolean;
  isCollection?: boolean;
  collectionName?: string;
  streamingUrl?: string;
}) {
  return prisma.auction.create({
    data: {
      startsAt: new Date(data.startsAt),
      status: data.status ?? "scheduled",
      currency: data.currency,
      category: data.category,
      auctioneerId: data.auctioneerId ?? null,
      location: data.location ?? null,
      attendeeCapacity: data.attendeeCapacity ?? null,
      hasWarehouse: data.hasWarehouse ?? false,
      ownSecurity: data.ownSecurity ?? false,
      isCollection: data.isCollection ?? false,
      collectionName: data.collectionName ?? null,
      streamingUrl: data.streamingUrl ?? null,
    },
  });
}

// ── POST /auctions/collection (admin / dev) ───────────────────────────────────

/**
 * Crea una subasta de colección para todos los bienes de un dueño.
 * Consigna: "si hay muchos bienes de un mismo dueño → colección con su nombre".
 */
export async function createCollectionAuction(data: {
  ownerId: number;
  startsAt: string;
  currency: "ARS" | "USD";
  category: string;
  productIds?: number[];
  responsibleId: number;
}) {
  // Verificar que el dueño exista
  const owner = await prisma.owner.findUnique({ where: { id: data.ownerId } });
  if (!owner) throw notFound("Dueño");

  // Determinar los productos a incluir
  const productWhere: Record<string, unknown> = { ownerId: data.ownerId };
  if (data.productIds && data.productIds.length > 0) {
    productWhere.id = { in: data.productIds };
  }

  const products = await prisma.product.findMany({ where: productWhere });

  // Validar que todos los productIds solicitados pertenecen al dueño
  if (data.productIds && data.productIds.length > 0) {
    const foundIds = new Set(products.map((p) => p.id));
    const missing = data.productIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        422,
        `Los siguientes productos no pertenecen al dueño o no existen: ${missing.join(", ")}`
      );
    }
  }

  if (products.length === 0) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      422,
      "El dueño no tiene productos para incluir en la colección"
    );
  }

  const collectionName = `Colección ${owner.name}`;

  return prisma.$transaction(async (tx) => {
    // Crear la subasta
    const auction = await tx.auction.create({
      data: {
        startsAt: new Date(data.startsAt),
        status: "scheduled",
        currency: data.currency,
        category: data.category,
        isCollection: true,
        collectionName,
        hasWarehouse: false,
        ownSecurity: false,
      },
    });

    // Crear el catálogo
    const catalog = await tx.catalog.create({
      data: {
        auctionId: auction.id,
        responsibleId: data.responsibleId,
        description: collectionName,
      },
    });

    // Crear un CatalogItem por cada producto (lotNumber secuencial)
    await tx.catalogItem.createMany({
      data: products.map((product, i) => ({
        catalogId: catalog.id,
        productId: product.id,
        lotNumber: i + 1,
        basePrice: 0,
        commission: 0,
        status: "pending",
        auctioned: false,
      })),
    });

    return {
      ...mapAuction(auction),
      catalogId: catalog.id,
      itemCount: products.length,
    };
  });
}

// ── PATCH /auctions/:id (admin) ───────────────────────────────────────────────

export async function updateAuction(
  id: number,
  data: {
    startsAt?: string;
    status?: string;
    currency?: string;
    category?: string;
    auctioneerId?: number | null;
    location?: string | null;
    attendeeCapacity?: number | null;
    hasWarehouse?: boolean;
    ownSecurity?: boolean;
    isCollection?: boolean;
    collectionName?: string | null;
    streamingUrl?: string | null;
  }
) {
  const existing = await prisma.auction.findUnique({ where: { id } });
  if (!existing) throw notFound("Subasta");

  return prisma.auction.update({
    where: { id },
    data: {
      ...(data.startsAt !== undefined && { startsAt: new Date(data.startsAt) }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.auctioneerId !== undefined && { auctioneerId: data.auctioneerId }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.attendeeCapacity !== undefined && { attendeeCapacity: data.attendeeCapacity }),
      ...(data.hasWarehouse !== undefined && { hasWarehouse: data.hasWarehouse }),
      ...(data.ownSecurity !== undefined && { ownSecurity: data.ownSecurity }),
      ...(data.isCollection !== undefined && { isCollection: data.isCollection }),
      ...(data.collectionName !== undefined && { collectionName: data.collectionName }),
      ...(data.streamingUrl !== undefined && { streamingUrl: data.streamingUrl }),
    },
  });
}

// ── GET /auctions/:id/catalog ─────────────────────────────────────────────────

export async function getAuctionCatalog(auctionId: number, isAuthenticated: boolean) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      catalog: {
        include: {
          items: {
            include: {
              product: { include: { photos: true } },
            },
            orderBy: { lotNumber: "asc" },
          },
        },
      },
    },
  });

  if (!auction) throw notFound("Subasta");
  if (!auction.catalog) throw notFound("Catálogo");

  return {
    catalogId: auction.catalog.id,
    description: auction.catalog.description,
    auctionId: auction.id,
    items: auction.catalog.items.map((item) => ({
      id: item.id,
      lotNumber: item.lotNumber,
      catalogDescription: item.product.catalogDescription,
      basePrice: isAuthenticated ? item.basePrice : null,
      commission: item.commission,
      status: item.status,
      auctioned: item.auctioned,
      photo: item.product.photos[0]?.photoUrl ?? null,
    })),
  };
}

// ── GET /auctions/:id/streaming ──────────────────────────────────────────────

export async function getStreamingUrl(auctionId: number, clientId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || !client.admitted) {
    throw new AppError(ErrorCode.NOT_ADMITTED, 403, "Tu cuenta no está verificada aún");
  }

  const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 horas
  return {
    url: auction.streamingUrl ?? `https://stream.auctify.example/auction/${auctionId}`,
    expiresAt: expiresAt.toISOString(),
  };
}

// ── POST /auctions/:id/attendees ─────────────────────────────────────────────

export async function registerAttendee(auctionId: number, clientId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      paymentMethods: { where: { status: "verified" }, select: { id: true } },
    },
  });
  if (!client) throw notFound("Cliente");

  const isAdmin = client.category === "platinum";

  if (!client.admitted) {
    throw new AppError(ErrorCode.NOT_ADMITTED, 403, "Tu cuenta no está verificada aún");
  }
  if (client.blocked) {
    throw new AppError(ErrorCode.CLIENT_BLOCKED, 403, "La cuenta está bloqueada");
  }
  if (!isAdmin && !isCategorySufficient(auction.category, client.category)) {
    throw new AppError(
      ErrorCode.CATEGORY_INSUFFICIENT,
      403,
      "Tu categoría no es suficiente para esta subasta"
    );
  }
  if (!isAdmin && client.paymentMethods.length === 0) {
    throw new AppError(
      ErrorCode.NO_VERIFIED_PAYMENT_METHOD,
      403,
      "Necesitás al menos un medio de pago verificado"
    );
  }

  const existing = await prisma.attendee.findUnique({
    where: { auctionId_clientId: { auctionId, clientId } },
  });
  if (existing) {
    throw new AppError(ErrorCode.DUPLICATE_ENTRY, 409, "Ya estás registrado en esta subasta");
  }

  const maxBidder = await prisma.attendee.findFirst({
    where: { auctionId },
    orderBy: { bidderNumber: "desc" },
    select: { bidderNumber: true },
  });
  const bidderNumber = (maxBidder?.bidderNumber ?? 0) + 1;

  return prisma.attendee.create({
    data: { auctionId, clientId, bidderNumber },
  });
}

// ── GET /auctions/:id/attendees ──────────────────────────────────────────────

export async function listAttendees(auctionId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  return prisma.attendee.findMany({ where: { auctionId }, orderBy: { bidderNumber: "asc" } });
}

// ── POST /auctions/:id/connect ───────────────────────────────────────────────

export async function connectToAuction(auctionId: number, clientId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  if (auction.status !== "open") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, "La subasta no está abierta");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      paymentMethods: { where: { status: "verified" }, select: { id: true } },
    },
  });
  if (!client) throw notFound("Cliente");

  const isAdmin = client.category === "platinum";

  if (!client.admitted) {
    throw new AppError(ErrorCode.NOT_ADMITTED, 403, "Tu cuenta no está verificada aún");
  }
  if (client.blocked) {
    throw new AppError(ErrorCode.CLIENT_BLOCKED, 403, "La cuenta está bloqueada");
  }
  if (!isAdmin && !isCategorySufficient(auction.category, client.category)) {
    throw new AppError(
      ErrorCode.CATEGORY_INSUFFICIENT,
      403,
      "Tu categoría no es suficiente para esta subasta"
    );
  }
  if (!isAdmin && client.paymentMethods.length === 0) {
    throw new AppError(
      ErrorCode.NO_VERIFIED_PAYMENT_METHOD,
      403,
      "Necesitás al menos un medio de pago verificado"
    );
  }

  const activeSession = await prisma.auctionSession.findFirst({
    where: { clientId, active: true },
  });
  if (activeSession) {
    if (activeSession.auctionId === auctionId) {
      return activeSession;
    }
    throw new AppError(
      ErrorCode.ALREADY_CONNECTED,
      409,
      "Ya estás conectado a otra subasta. Desconectate primero.",
      { auctionId: activeSession.auctionId }
    );
  }

  let attendee = await prisma.attendee.findUnique({
    where: { auctionId_clientId: { auctionId, clientId } },
  });
  if (!attendee) {
    const maxBidder = await prisma.attendee.findFirst({
      where: { auctionId },
      orderBy: { bidderNumber: "desc" },
      select: { bidderNumber: true },
    });
    const bidderNumber = (maxBidder?.bidderNumber ?? 0) + 1;
    attendee = await prisma.attendee.create({
      data: { auctionId, clientId, bidderNumber },
    });
  }

  return prisma.auctionSession.create({
    data: { auctionId, clientId, startedAt: new Date(), active: true },
  });
}

// ── POST /auctions/:id/items/:itemId/open ────────────────────────────────────

/**
 * Abre (activa) un ítem del catálogo para subastarse en vivo.
 * Sólo ADMIN. Emite AuctionEvent 'item_opened'; incrementa auction.version.
 */
export async function openItem(auctionId: number, itemId: number) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { catalog: { include: { items: { where: { id: itemId } } } } },
  });
  if (!auction) throw notFound("Subasta");
  if (!auction.catalog) throw notFound("Catálogo");

  const item = auction.catalog.items[0];
  if (!item) throw notFound("Ítem del catálogo");

  if (item.status === "active") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, "El ítem ya está activo");
  }
  if (item.status === "sold" || item.status === "unsold") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, "El ítem ya fue adjudicado");
  }

  const [updatedItem, updatedAuction] = await prisma.$transaction([
    prisma.catalogItem.update({
      where: { id: itemId },
      data: { status: "active" },
      include: { product: { select: { id: true, catalogDescription: true } } },
    }),
    prisma.auction.update({
      where: { id: auctionId },
      data: { currentItemId: itemId, version: { increment: 1 } },
    }),
  ]);

  await prisma.auctionEvent.create({
    data: {
      auctionId,
      type: "item_opened",
      data: JSON.stringify({ itemId, lotNumber: item.lotNumber }),
    },
  });

  return {
    itemId: updatedItem.id,
    lotNumber: updatedItem.lotNumber,
    status: updatedItem.status,
    basePrice: updatedItem.basePrice,
    catalogDescription: updatedItem.product.catalogDescription,
    auctionVersion: updatedAuction.version,
  };
}

// ── POST /auctions/:id/items/:itemId/close ────────────────────────────────────

/**
 * Adjudica (cierra) un ítem.
 * Si hay pujas: marca la ganadora, crea SaleRecord, notifica al ganador.
 * Si no hay pujas: marca item como 'unsold', boughtByCompany=true.
 * Emite AuctionEvent 'item_sold' o 'item_unsold'; incrementa auction.version.
 */
export async function closeItem(auctionId: number, itemId: number) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      catalog: {
        include: {
          items: {
            where: { id: itemId },
            include: {
              product: { select: { id: true, ownerId: true, catalogDescription: true } },
              bids: {
                include: { attendee: { select: { clientId: true } } },
                orderBy: { amount: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!auction) throw notFound("Subasta");
  if (!auction.catalog) throw notFound("Catálogo");

  const item = auction.catalog.items[0];
  if (!item) throw notFound("Ítem del catálogo");

  if (item.status !== "active") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, "El ítem no está activo");
  }

  const bids = item.bids;
  const winningBid = bids.length > 0 ? bids[0] : null;

  if (winningBid) {
    // ── Hay ganador ──────────────────────────────────────────────────────────
    const winnerClientId = winningBid.attendee.clientId;

    // Calcular comisión: si item.commission ≤ 1 → tasa (e.g. 0.10 = 10%)
    // si > 1 → monto absoluto (legacy). Almacenar siempre el monto en pesos.
    const commissionAmount =
      item.commission <= 1
        ? Math.round(winningBid.amount * item.commission * 100) / 100
        : item.commission;

    const result = await prisma.$transaction(async (tx) => {
      // Marcar bid ganadora y las demás como perdedoras
      await tx.bid.update({ where: { id: winningBid.id }, data: { winner: true } });
      if (bids.length > 1) {
        await tx.bid.updateMany({
          where: { itemId, id: { not: winningBid.id } },
          data: { winner: false },
        });
      }

      // Crear SaleRecord
      const saleRecord = await tx.saleRecord.create({
        data: {
          auctionId,
          ownerId: item.product.ownerId,
          productId: item.product.id,
          clientId: winnerClientId,
          amount: winningBid.amount,
          commission: commissionAmount,
          paymentMethodId: winningBid.paymentMethodId,
          boughtByCompany: false,
          paymentStatus: "pending",
          pickupInPerson: false,
        },
      });

      // Actualizar item → sold
      await tx.catalogItem.update({
        where: { id: itemId },
        data: { status: "sold", auctioned: true },
      });

      // Limpiar currentItemId y versionar
      const updatedAuction = await tx.auction.update({
        where: { id: auctionId },
        data: { currentItemId: null, version: { increment: 1 } },
      });

      await tx.auctionEvent.create({
        data: {
          auctionId,
          type: "item_sold",
          data: JSON.stringify({
            itemId,
            saleRecordId: saleRecord.id,
            amount: winningBid.amount,
            winnerClientId,
          }),
        },
      });

      return { saleRecord, auctionVersion: updatedAuction.version };
    });

    // Notificar al ganador (fuera de la tx para no bloquear)
    const desc = item.product.catalogDescription ?? `Lote #${item.lotNumber}`;
    await createNotification(
      winnerClientId,
      "auction_winner",
      "¡Ganaste la subasta!",
      `Ganaste "${desc}" por $${winningBid.amount}. Pasá a pagar.`,
      {
        saleRecordId: result.saleRecord.id,
        itemId,
        amount: winningBid.amount,
      }
    );

    // Verificar si el dueño tiene cuenta de cobro declarada antes del inicio
    const ownerHasValidPayoutAccount = await prisma.payoutAccount
      .count({
        where: {
          ownerId: item.product.ownerId,
          declaredAt: { lte: auction.startsAt },
        },
      })
      .then((n) => n > 0);

    return { ...result.saleRecord, ownerHasValidPayoutAccount };
  } else {
    // ── Sin pujas: empresa compra al base ────────────────────────────────────
    const ownerId = item.product.ownerId;

    // Verificar si el dueño tiene cuenta de cobro declarada antes del inicio
    const ownerHasValidPayoutAccount = await prisma.payoutAccount
      .count({
        where: {
          ownerId,
          declaredAt: { lte: auction.startsAt },
        },
      })
      .then((n) => n > 0);

    const companySaleRecord = await prisma.$transaction(async (tx) => {
      const saleRecord = await tx.saleRecord.create({
        data: {
          auctionId,
          ownerId,
          productId: item.product.id,
          clientId: null,
          paymentMethodId: null,
          amount: item.basePrice,
          commission: 0,
          boughtByCompany: true,
          paymentStatus: "pending",
          pickupInPerson: false,
        },
      });

      await tx.catalogItem.update({
        where: { id: itemId },
        data: { status: "sold", auctioned: true },
      });

      await tx.auction.update({
        where: { id: auctionId },
        data: { currentItemId: null, version: { increment: 1 } },
      });

      await tx.auctionEvent.create({
        data: {
          auctionId,
          type: "item_sold",
          data: JSON.stringify({
            itemId,
            saleRecordId: saleRecord.id,
            amount: item.basePrice,
            boughtByCompany: true,
          }),
        },
      });

      return saleRecord;
    });

    return { ...companySaleRecord, ownerHasValidPayoutAccount };
  }
}

// ── POST /auctions/:id/close ──────────────────────────────────────────────────

/**
 * Cierra la subasta completa.
 * Emite AuctionEvent 'auction_ended'; incrementa auction.version.
 */
export async function closeAuction(auctionId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  if (auction.status === "closed") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, "La subasta ya está cerrada");
  }

  const [updatedAuction] = await prisma.$transaction([
    prisma.auction.update({
      where: { id: auctionId },
      data: { status: "closed", version: { increment: 1 } },
    }),
    prisma.auctionEvent.create({
      data: {
        auctionId,
        type: "auction_ended",
        data: JSON.stringify({ auctionId }),
      },
    }),
  ]);

  return { id: updatedAuction.id, status: updatedAuction.status, version: updatedAuction.version };
}

// ── POST /auctions/:id/disconnect ────────────────────────────────────────────

export async function disconnectFromAuction(auctionId: number, clientId: number) {
  const session = await prisma.auctionSession.findFirst({
    where: { auctionId, clientId, active: true },
  });

  if (!session) throw notFound("Sesión activa");

  return prisma.auctionSession.update({
    where: { id: session.id },
    data: { active: false, endedAt: new Date() },
  });
}

// ── GET /auctions/:id/live-status ────────────────────────────────────────────

export async function getLiveStatus(auctionId: number, clientId: number) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      currentItem: {
        include: {
          product: { select: { id: true, catalogDescription: true } },
          bids: {
            orderBy: { amount: "desc" },
            take: 1,
            include: { attendee: { select: { bidderNumber: true } } },
          },
        },
      },
    },
  });

  if (!auction) throw notFound("Subasta");

  const currentItemId = auction.currentItemId;
  const hasCurrentItem = !!(currentItemId && auction.currentItem);

  // Lecturas independientes en paralelo (hot-path de polling).
  // Las consultas dependientes del ítem actual sólo se incluyen si hay ítem en curso.
  const [
    session,
    connectedCount,
    lastBidRow,
    bidCount,
    clientHasBid,
    clientIsWinner,
    lastEventRow,
  ] = await Promise.all([
    prisma.auctionSession.findFirst({
      where: { auctionId, clientId, active: true },
    }),
    prisma.auctionSession.count({
      where: { auctionId, active: true },
    }),
    hasCurrentItem
      ? prisma.bid.findFirst({
          where: { itemId: currentItemId! },
          orderBy: { timestamp: "desc" },
          select: { amount: true },
        })
      : Promise.resolve(null),
    hasCurrentItem
      ? prisma.bid.count({ where: { itemId: currentItemId! } })
      : Promise.resolve(0),
    hasCurrentItem
      ? prisma.bid.findFirst({
          where: { itemId: currentItemId!, attendee: { clientId } },
        })
      : Promise.resolve(null),
    hasCurrentItem
      ? prisma.bid.findFirst({
          where: { itemId: currentItemId!, attendee: { clientId }, winner: true },
        })
      : Promise.resolve(null),
    prisma.auctionEvent.findFirst({
      where: { auctionId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!session) {
    throw new AppError(ErrorCode.NOT_CONNECTED, 403, "No estás conectado a esta subasta");
  }

  let currentItem = null;
  if (hasCurrentItem) {
    const item = auction.currentItem!;

    // Reutiliza la mejor puja incluida en el findUnique inicial
    // (currentItem.bids con take:1, orderBy amount desc).
    const bestBidRow = item.bids[0] ?? null;
    const bestBid = bestBidRow?.amount ?? null;
    const lastBidAmount = lastBidRow?.amount ?? null;

    const { minBidAllowed, maxBidAllowed } = computeRange(
      item,
      auction.category,
      bestBid,
      lastBidAmount
    );

    currentItem = {
      itemId: item.id,
      productId: item.productId,
      catalogDescription: item.product.catalogDescription ?? `Lote #${item.id}`,
      basePrice: item.basePrice,
      bestBid,
      bestBidBidderNumber: bestBidRow?.attendee.bidderNumber ?? null,
      minBidAllowed,
      maxBidAllowed,
      bidCount,
    };
  }

  const youWereOutbid =
    hasCurrentItem && clientHasBid !== null && clientIsWinner === null;

  const youAreLeading =
    hasCurrentItem && clientIsWinner !== null;

  let lastEvent = null;
  if (lastEventRow) {
    let parsedData: Record<string, unknown> = {};
    try {
      parsedData = JSON.parse(lastEventRow.data) as Record<string, unknown>;
    } catch {
      parsedData = {};
    }
    lastEvent = {
      type: lastEventRow.type,
      timestamp: lastEventRow.createdAt.toISOString(),
      data: parsedData,
    };
  }

  return {
    version: auction.version,
    auctionId: auction.id,
    auctionStatus: auction.status,
    connectedCount,
    currentItem,
    youWereOutbid,
    youAreLeading,
    lastEvent,
    updatedAt: new Date().toISOString(),
  };
}
