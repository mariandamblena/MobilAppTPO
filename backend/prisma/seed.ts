/**
 * Seed de desarrollo rico e idempotente.
 *
 * Cubre los flujos principales de Auctify sin borrar datos locales:
 * auth, clientes, duenios, medios de pago, subastas, catalogos, pujas,
 * ventas, multas, notificaciones, solicitudes de inclusion, seguros y cobros.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORDS = {
  admin: "Admin123!",
  bidder: "Secret123!",
  owner: "Owner123!",
  silver: "Silver123!",
  common: "Common123!",
  blocked: "Blocked123!",
  review: "Review123!",
  usd: "Usd123!",
};

const passwordHashCache = new Map<string, string>();

async function hashPassword(password: string) {
  const cached = passwordHashCache.get(password);
  if (cached) return cached;

  const hash = await bcrypt.hash(password, 10);
  passwordHashCache.set(password, hash);
  return hash;
}

function daysFromNow(days: number, hours = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours, 0, 0, 0);
  return date;
}

function photoSeed(key: string, count = 6) {
  return Array.from(
    { length: count },
    (_, index) => `https://picsum.photos/seed/auctify-${key}-${index + 1}/1200/900`
  );
}

async function seedCountries() {
  const countries = [
    { id: 1, name: "Argentina", shortName: "AR", capital: "Buenos Aires", nationality: "argentina", languages: "espanol" },
    { id: 2, name: "Uruguay", shortName: "UY", capital: "Montevideo", nationality: "uruguaya", languages: "espanol" },
    { id: 3, name: "Brasil", shortName: "BR", capital: "Brasilia", nationality: "brasilena", languages: "portugues" },
    { id: 4, name: "Chile", shortName: "CL", capital: "Santiago", nationality: "chilena", languages: "espanol" },
    { id: 5, name: "Espana", shortName: "ES", capital: "Madrid", nationality: "espanola", languages: "espanol" },
    { id: 6, name: "Estados Unidos", shortName: "US", capital: "Washington D.C.", nationality: "estadounidense", languages: "ingles" },
    { id: 7, name: "Francia", shortName: "FR", capital: "Paris", nationality: "francesa", languages: "frances" },
  ];

  for (const country of countries) {
    await prisma.country.upsert({
      where: { id: country.id },
      update: country,
      create: country,
    });
  }

  return countries;
}

async function ensureClient(input: {
  document: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  address: string;
  countryId: number;
  admitted: boolean;
  category: string | null;
  blocked?: boolean;
  verifierId?: number | null;
  photoKey: string;
}) {
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const data = {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    passwordHash,
    address: input.address,
    countryId: input.countryId,
    admitted: input.admitted,
    category: input.category,
    blocked: input.blocked ?? false,
    active: true,
    verifierId: input.verifierId ?? null,
    photoUrl: `https://picsum.photos/seed/auctify-client-${input.photoKey}/600/600`,
    idCardFrontUrl: `https://picsum.photos/seed/auctify-id-front-${input.document}/1000/650`,
    idCardBackUrl: `https://picsum.photos/seed/auctify-id-back-${input.document}/1000/650`,
  };

  return prisma.client.upsert({
    where: { document: input.document },
    update: data,
    create: {
      document: input.document,
      ...data,
    },
  });
}

async function ensureActivationToken(clientId: number, token: string) {
  return prisma.activationToken.upsert({
    where: { token },
    update: {
      clientId,
      expiresAt: daysFromNow(2),
      usedAt: null,
    },
    create: {
      clientId,
      token,
      expiresAt: daysFromNow(2),
    },
  });
}

async function ensurePaymentMethod(input: {
  clientId: number;
  type: string;
  currency: string;
  detail: string;
  bank?: string | null;
  countryId?: number | null;
  reservedAmount?: number | null;
  status: string;
  rejectionReason?: string | null;
}) {
  const existing = await prisma.paymentMethod.findFirst({
    where: {
      clientId: input.clientId,
      type: input.type,
      currency: input.currency,
      detail: input.detail,
    },
  });

  const data = {
    bank: input.bank ?? null,
    countryId: input.countryId ?? null,
    reservedAmount: input.reservedAmount ?? null,
    status: input.status,
    rejectionReason: input.rejectionReason ?? null,
  };

  if (existing) {
    return prisma.paymentMethod.update({ where: { id: existing.id }, data });
  }

  return prisma.paymentMethod.create({
    data: {
      clientId: input.clientId,
      type: input.type,
      currency: input.currency,
      detail: input.detail,
      ...data,
    },
  });
}

async function ensureOwner(input: {
  document: string;
  name: string;
  address: string;
  countryId: number;
  verifierId: number;
  riskRating: number;
  financialVerification?: boolean;
  judicialVerification?: boolean;
  photoKey: string;
}) {
  return prisma.owner.upsert({
    where: { document: input.document },
    update: {
      name: input.name,
      address: input.address,
      countryId: input.countryId,
      verifierId: input.verifierId,
      riskRating: input.riskRating,
      financialVerification: input.financialVerification ?? true,
      judicialVerification: input.judicialVerification ?? true,
      active: true,
      photoUrl: `https://picsum.photos/seed/auctify-owner-${input.photoKey}/600/600`,
    },
    create: {
      document: input.document,
      name: input.name,
      address: input.address,
      countryId: input.countryId,
      verifierId: input.verifierId,
      riskRating: input.riskRating,
      financialVerification: input.financialVerification ?? true,
      judicialVerification: input.judicialVerification ?? true,
      active: true,
      photoUrl: `https://picsum.photos/seed/auctify-owner-${input.photoKey}/600/600`,
    },
  });
}

async function ensurePayoutAccount(input: {
  ownerId: number;
  bank: string;
  countryId?: number | null;
  currency: string;
  cbuOrIban: string;
  accountHolder: string;
  declaredAt: Date;
}) {
  const existing = await prisma.payoutAccount.findFirst({
    where: { ownerId: input.ownerId, cbuOrIban: input.cbuOrIban },
  });

  const data = {
    bank: input.bank,
    countryId: input.countryId ?? null,
    currency: input.currency,
    accountHolder: input.accountHolder,
    declaredAt: input.declaredAt,
  };

  if (existing) {
    return prisma.payoutAccount.update({ where: { id: existing.id }, data });
  }

  return prisma.payoutAccount.create({
    data: {
      ownerId: input.ownerId,
      cbuOrIban: input.cbuOrIban,
      ...data,
    },
  });
}

async function ensureInsurance(input: {
  policyNumber: string;
  company: string;
  combinedPolicy: boolean;
  amount: number;
}) {
  return prisma.insurance.upsert({
    where: { policyNumber: input.policyNumber },
    update: input,
    create: input,
  });
}

async function ensureAuction(input: {
  startsAt: Date;
  status: string;
  currency: string;
  category: string;
  auctioneerId?: number | null;
  location: string;
  attendeeCapacity?: number | null;
  hasWarehouse?: boolean;
  ownSecurity?: boolean;
  streamingUrl?: string | null;
  isCollection?: boolean;
  collectionName?: string | null;
}) {
  const existing = await prisma.auction.findFirst({
    where: { location: input.location },
  });

  const data = {
    startsAt: input.startsAt,
    status: input.status,
    currency: input.currency,
    category: input.category,
    auctioneerId: input.auctioneerId ?? null,
    attendeeCapacity: input.attendeeCapacity ?? null,
    hasWarehouse: input.hasWarehouse ?? true,
    ownSecurity: input.ownSecurity ?? true,
    streamingUrl: input.streamingUrl ?? null,
    isCollection: input.isCollection ?? false,
    collectionName: input.collectionName ?? null,
  };

  if (existing) {
    return prisma.auction.update({ where: { id: existing.id }, data });
  }

  return prisma.auction.create({
    data: {
      location: input.location,
      ...data,
    },
  });
}

async function ensureCatalog(auctionId: number, description: string, responsibleId: number) {
  return prisma.catalog.upsert({
    where: { auctionId },
    update: { description, responsibleId },
    create: { auctionId, description, responsibleId },
  });
}

async function ensureProduct(input: {
  ownerId: number;
  fullDescription: string;
  catalogDescription: string;
  date?: Date | null;
  available?: boolean;
  reviewerId?: number | null;
  insurancePolicy?: string | null;
  pieceCount?: number;
  artist?: string | null;
  historicalDate?: string | null;
  history?: string | null;
  photos: string[];
  location?: {
    warehouse: string;
    address: string;
    receivedAt: Date;
  };
}) {
  const existing = await prisma.product.findFirst({
    where: {
      ownerId: input.ownerId,
      fullDescription: input.fullDescription,
    },
  });

  const data = {
    catalogDescription: input.catalogDescription,
    date: input.date ?? null,
    available: input.available ?? true,
    reviewerId: input.reviewerId ?? null,
    insurancePolicy: input.insurancePolicy ?? null,
    pieceCount: input.pieceCount ?? 1,
    artist: input.artist ?? null,
    historicalDate: input.historicalDate ?? null,
    history: input.history ?? null,
  };

  const product = existing
    ? await prisma.product.update({ where: { id: existing.id }, data })
    : await prisma.product.create({
        data: {
          ownerId: input.ownerId,
          fullDescription: input.fullDescription,
          ...data,
        },
      });

  for (const photoUrl of input.photos) {
    const existingPhoto = await prisma.photo.findFirst({
      where: { productId: product.id, photoUrl },
    });
    if (!existingPhoto) {
      await prisma.photo.create({ data: { productId: product.id, photoUrl } });
    }
  }

  if (input.location) {
    await prisma.productLocation.upsert({
      where: { productId: product.id },
      update: input.location,
      create: { productId: product.id, ...input.location },
    });
  }

  return product;
}

async function ensureCatalogItem(input: {
  catalogId: number;
  productId: number;
  lotNumber: number;
  basePrice: number;
  commission: number;
  status?: string;
  auctioned?: boolean;
  insurancePolicy?: string | null;
}) {
  const existing = await prisma.catalogItem.findFirst({
    where: { catalogId: input.catalogId, lotNumber: input.lotNumber },
  });

  const data = {
    productId: input.productId,
    basePrice: input.basePrice,
    commission: input.commission,
    status: input.status ?? "pending",
    auctioned: input.auctioned ?? false,
    insurancePolicy: input.insurancePolicy ?? null,
  };

  if (existing) {
    return prisma.catalogItem.update({ where: { id: existing.id }, data });
  }

  return prisma.catalogItem.create({
    data: {
      catalogId: input.catalogId,
      lotNumber: input.lotNumber,
      ...data,
    },
  });
}

async function ensureAttendee(auctionId: number, clientId: number, bidderNumber?: number) {
  const existing = await prisma.attendee.findUnique({
    where: { auctionId_clientId: { auctionId, clientId } },
  });
  if (existing) {
    if (bidderNumber && existing.bidderNumber !== bidderNumber) {
      const numberTaken = await prisma.attendee.findUnique({
        where: { auctionId_bidderNumber: { auctionId, bidderNumber } },
      });
      if (!numberTaken) {
        return prisma.attendee.update({ where: { id: existing.id }, data: { bidderNumber } });
      }
    }
    return existing;
  }

  let nextNumber = bidderNumber;
  if (!nextNumber) {
    const maxBidder = await prisma.attendee.findFirst({
      where: { auctionId },
      orderBy: { bidderNumber: "desc" },
      select: { bidderNumber: true },
    });
    nextNumber = (maxBidder?.bidderNumber ?? 0) + 1;
  }

  return prisma.attendee.create({
    data: { auctionId, clientId, bidderNumber: nextNumber },
  });
}

async function ensureActiveSession(auctionId: number, clientId: number, startedAt: Date) {
  const activeSession = await prisma.auctionSession.findFirst({
    where: { clientId, active: true },
  });

  if (activeSession) {
    if (activeSession.auctionId === auctionId) return activeSession;
    return activeSession;
  }

  return prisma.auctionSession.create({
    data: { auctionId, clientId, startedAt, active: true },
  });
}

async function ensureAuctionEvent(
  auctionId: number,
  type: string,
  data: Record<string, unknown>,
  createdAt: Date
) {
  const serialized = JSON.stringify(data);
  const existing = await prisma.auctionEvent.findFirst({
    where: { auctionId, type, data: serialized },
  });

  if (existing) {
    return prisma.auctionEvent.update({ where: { id: existing.id }, data: { createdAt } });
  }

  return prisma.auctionEvent.create({
    data: { auctionId, type, data: serialized, createdAt },
  });
}

async function ensureBid(input: {
  itemId: number;
  attendeeId: number;
  paymentMethodId: number;
  amount: number;
  idempotencyKey: string;
  timestamp: Date;
}) {
  const existing = await prisma.bid.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (existing) {
    return prisma.bid.update({
      where: { id: existing.id },
      data: {
        itemId: input.itemId,
        attendeeId: input.attendeeId,
        paymentMethodId: input.paymentMethodId,
        amount: input.amount,
        timestamp: input.timestamp,
      },
    });
  }

  return prisma.bid.create({
    data: {
      itemId: input.itemId,
      attendeeId: input.attendeeId,
      paymentMethodId: input.paymentMethodId,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
      timestamp: input.timestamp,
    },
  });
}

async function syncBidWinners(itemId: number) {
  await prisma.bid.updateMany({ where: { itemId }, data: { winner: false } });
  const topBid = await prisma.bid.findFirst({
    where: { itemId },
    orderBy: [{ amount: "desc" }, { timestamp: "desc" }],
  });
  if (topBid) {
    await prisma.bid.update({ where: { id: topBid.id }, data: { winner: true } });
  }
  return topBid;
}

async function ensureSaleRecord(input: {
  auctionId: number;
  ownerId: number;
  productId: number;
  clientId: number | null;
  amount: number;
  commission: number;
  paymentMethodId: number | null;
  shippingCost?: number | null;
  pickupInPerson?: boolean;
  shippingAddress?: string | null;
  boughtByCompany?: boolean;
  insuranceCovered?: boolean;
  paymentStatus: string;
  paidAt?: Date | null;
  createdAt: Date;
}) {
  const existing = await prisma.saleRecord.findFirst({
    where: {
      auctionId: input.auctionId,
      productId: input.productId,
      clientId: input.clientId,
      amount: input.amount,
    },
  });

  const data = {
    ownerId: input.ownerId,
    commission: input.commission,
    paymentMethodId: input.paymentMethodId,
    shippingCost: input.shippingCost ?? null,
    pickupInPerson: input.pickupInPerson ?? false,
    shippingAddress: input.shippingAddress ?? null,
    boughtByCompany: input.boughtByCompany ?? false,
    insuranceCovered: input.insuranceCovered ?? true,
    paymentStatus: input.paymentStatus,
    paidAt: input.paidAt ?? null,
    createdAt: input.createdAt,
  };

  if (existing) {
    return prisma.saleRecord.update({ where: { id: existing.id }, data });
  }

  return prisma.saleRecord.create({
    data: {
      auctionId: input.auctionId,
      productId: input.productId,
      clientId: input.clientId,
      amount: input.amount,
      ...data,
    },
  });
}

async function ensurePenalty(input: {
  clientId: number;
  auctionId: number;
  itemId: number;
  amount: number;
  status: string;
  dueAt?: Date | null;
  paidAt?: Date | null;
  createdAt: Date;
}) {
  const existing = await prisma.penalty.findFirst({
    where: {
      clientId: input.clientId,
      auctionId: input.auctionId,
      itemId: input.itemId,
      amount: input.amount,
    },
  });

  const data = {
    status: input.status,
    dueAt: input.dueAt ?? null,
    paidAt: input.paidAt ?? null,
    createdAt: input.createdAt,
  };

  if (existing) {
    return prisma.penalty.update({ where: { id: existing.id }, data });
  }

  return prisma.penalty.create({
    data: {
      clientId: input.clientId,
      auctionId: input.auctionId,
      itemId: input.itemId,
      amount: input.amount,
      ...data,
    },
  });
}

async function ensureNotification(input: {
  clientId: number;
  type: string;
  title: string;
  message: string;
  read?: boolean;
  payload?: Record<string, unknown> | null;
  createdAt: Date;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      clientId: input.clientId,
      type: input.type,
      title: input.title,
      message: input.message,
    },
  });

  const data = {
    read: input.read ?? false,
    payload: input.payload ? JSON.stringify(input.payload) : null,
    createdAt: input.createdAt,
  };

  if (existing) {
    return prisma.notification.update({ where: { id: existing.id }, data });
  }

  return prisma.notification.create({
    data: {
      clientId: input.clientId,
      type: input.type,
      title: input.title,
      message: input.message,
      ...data,
    },
  });
}

async function ensureInclusionRequest(input: {
  ownerId: number;
  productId: number;
  itemDescription: string;
  ownershipDeclared: boolean;
  legalityDeclared: boolean;
  status: string;
  rejectionReason?: string | null;
  proposedBasePrice?: number | null;
  proposedCommission?: number | null;
  proposedAuctionId?: number | null;
  returnShippingCost?: number | null;
  createdAt: Date;
}) {
  const existing = await prisma.inclusionRequest.findFirst({
    where: {
      ownerId: input.ownerId,
      productId: input.productId,
      itemDescription: input.itemDescription,
    },
  });

  const data = {
    ownershipDeclared: input.ownershipDeclared,
    legalityDeclared: input.legalityDeclared,
    status: input.status,
    rejectionReason: input.rejectionReason ?? null,
    proposedBasePrice: input.proposedBasePrice ?? null,
    proposedCommission: input.proposedCommission ?? null,
    proposedAuctionId: input.proposedAuctionId ?? null,
    returnShippingCost: input.returnShippingCost ?? null,
    createdAt: input.createdAt,
  };

  if (existing) {
    return prisma.inclusionRequest.update({ where: { id: existing.id }, data });
  }

  return prisma.inclusionRequest.create({
    data: {
      ownerId: input.ownerId,
      productId: input.productId,
      itemDescription: input.itemDescription,
      ...data,
    },
  });
}

async function syncAuctionVersion(auctionId: number) {
  const eventCount = await prisma.auctionEvent.count({ where: { auctionId } });
  return prisma.auction.update({
    where: { id: auctionId },
    data: { version: eventCount },
  });
}

async function main() {
  console.log("Seed Auctify: iniciando dataset demo...");

  await seedCountries();

  const admin = await ensureClient({
    document: "00000001",
    firstName: "Admin",
    lastName: "Auctify",
    email: "admin@auctify.dev",
    password: PASSWORDS.admin,
    address: "Av. Corrientes 1234, CABA",
    countryId: 1,
    admitted: true,
    category: "platinum",
    verifierId: null,
    photoKey: "admin",
  });

  const goldClient = await ensureClient({
    document: "30111222",
    firstName: "Juan",
    lastName: "Postor",
    email: "juan.postor@ejemplo.com",
    password: PASSWORDS.bidder,
    address: "Calle Falsa 123, Buenos Aires",
    countryId: 1,
    admitted: true,
    category: "gold",
    verifierId: admin.id,
    photoKey: "gold",
  });

  const silverClient = await ensureClient({
    document: "30222333",
    firstName: "Lucia",
    lastName: "Rivas",
    email: "lucia.rivas@ejemplo.com",
    password: PASSWORDS.silver,
    address: "Pueyrredon 880, Rosario",
    countryId: 1,
    admitted: true,
    category: "silver",
    verifierId: admin.id,
    photoKey: "silver",
  });

  const commonClient = await ensureClient({
    document: "30333444",
    firstName: "Tomas",
    lastName: "Bianchi",
    email: "tomas.bianchi@ejemplo.com",
    password: PASSWORDS.common,
    address: "Blanes 1902, Montevideo",
    countryId: 2,
    admitted: true,
    category: "common",
    verifierId: admin.id,
    photoKey: "common",
  });

  const blockedClient = await ensureClient({
    document: "30444555",
    firstName: "Martina",
    lastName: "Campos",
    email: "martina.campos@ejemplo.com",
    password: PASSWORDS.blocked,
    address: "Av. Santa Fe 2800, CABA",
    countryId: 1,
    admitted: true,
    category: "silver",
    blocked: true,
    verifierId: admin.id,
    photoKey: "blocked",
  });

  const pendingClient = await ensureClient({
    document: "30555666",
    firstName: "Pedro",
    lastName: "Molina",
    email: "pedro.molina@ejemplo.com",
    address: "San Martin 122, Cordoba",
    countryId: 1,
    admitted: false,
    category: null,
    verifierId: null,
    photoKey: "pending",
  });

  const paymentReviewClient = await ensureClient({
    document: "30666777",
    firstName: "Camila",
    lastName: "Ferreyra",
    email: "camila.ferreyra@ejemplo.com",
    password: PASSWORDS.review,
    address: "Chile 1440, Mendoza",
    countryId: 1,
    admitted: true,
    category: "special",
    verifierId: admin.id,
    photoKey: "review",
  });

  const usdClient = await ensureClient({
    document: "30777888",
    firstName: "Sofia",
    lastName: "Hayes",
    email: "sofia.hayes@ejemplo.com",
    password: PASSWORDS.usd,
    address: "Brickell Ave 900, Miami",
    countryId: 6,
    admitted: true,
    category: "gold",
    verifierId: admin.id,
    photoKey: "usd",
  });

  const activationClient = await ensureClient({
    document: "30888999",
    firstName: "Nicolas",
    lastName: "Suarez",
    email: "nicolas.suarez@ejemplo.com",
    address: "Alsina 720, Salta",
    countryId: 1,
    admitted: true,
    category: "common",
    verifierId: admin.id,
    photoKey: "activation",
  });
  await ensureActivationToken(activationClient.id, "act_seed_nicolas_suarez_2026");

  const ownerClient = await ensureClient({
    document: "20333444",
    firstName: "Maria",
    lastName: "Coleccionista",
    email: "maria.coleccionista@ejemplo.com",
    password: PASSWORDS.owner,
    address: "Palermo 456, CABA",
    countryId: 1,
    admitted: true,
    category: "gold",
    verifierId: admin.id,
    photoKey: "owner-maria",
  });

  const estateClient = await ensureClient({
    document: "20999888",
    firstName: "Esteban",
    lastName: "Lacroze",
    email: "esteban.lacroze@ejemplo.com",
    password: PASSWORDS.owner,
    address: "Avenida Alvear 1500, CABA",
    countryId: 1,
    admitted: true,
    category: "platinum",
    verifierId: admin.id,
    photoKey: "owner-esteban",
  });

  const goldOwner = await ensureOwner({
    document: goldClient.document,
    name: `${goldClient.firstName} ${goldClient.lastName}`,
    address: goldClient.address ?? "CABA",
    countryId: goldClient.countryId ?? 1,
    verifierId: admin.id,
    riskRating: 1,
    photoKey: "gold-owner",
  });

  const mariaOwner = await ensureOwner({
    document: ownerClient.document,
    name: "Maria Coleccionista",
    address: "Palermo 456, CABA",
    countryId: 1,
    verifierId: admin.id,
    riskRating: 2,
    photoKey: "maria",
  });

  const estateOwner = await ensureOwner({
    document: estateClient.document,
    name: "Sucesion Lacroze",
    address: "Avenida Alvear 1500, CABA",
    countryId: 1,
    verifierId: admin.id,
    riskRating: 3,
    photoKey: "estate",
  });

  const galleryOwner = await ensureOwner({
    document: "27666111",
    name: "Galeria Rio de la Plata",
    address: "Rambla 2400, Montevideo",
    countryId: 2,
    verifierId: admin.id,
    riskRating: 4,
    financialVerification: true,
    judicialVerification: false,
    photoKey: "gallery",
  });

  const goldBankArs = await ensurePaymentMethod({
    clientId: goldClient.id,
    type: "bank_account",
    currency: "ARS",
    detail: "CBU 0070999 / Cuenta Corriente",
    bank: "Banco Nacion",
    countryId: 1,
    status: "verified",
  });
  const goldCardArs = await ensurePaymentMethod({
    clientId: goldClient.id,
    type: "credit_card",
    currency: "ARS",
    detail: "Visa terminada en 4242",
    bank: "Banco Galicia",
    countryId: 1,
    status: "verified",
  });
  const silverBankArs = await ensurePaymentMethod({
    clientId: silverClient.id,
    type: "bank_account",
    currency: "ARS",
    detail: "CBU 0140888 / Caja de Ahorro",
    bank: "BBVA",
    countryId: 1,
    status: "verified",
  });
  await ensurePaymentMethod({
    clientId: commonClient.id,
    type: "bank_account",
    currency: "ARS",
    detail: "CBU 0210777 / Caja de Ahorro",
    bank: "Santander",
    countryId: 1,
    status: "verified",
  });
  const blockedCheck = await ensurePaymentMethod({
    clientId: blockedClient.id,
    type: "certified_check",
    currency: "ARS",
    detail: "Cheque certificado CHK-9001",
    bank: "Banco Provincia",
    countryId: 1,
    reservedAmount: 80_000,
    status: "verified",
  });
  await ensurePaymentMethod({
    clientId: paymentReviewClient.id,
    type: "credit_card",
    currency: "ARS",
    detail: "Mastercard terminada en 1881",
    bank: "ICBC",
    countryId: 1,
    status: "pending",
  });
  await ensurePaymentMethod({
    clientId: paymentReviewClient.id,
    type: "bank_account",
    currency: "ARS",
    detail: "CBU rechazado 000000000001",
    bank: "Banco Ciudad",
    countryId: 1,
    status: "rejected",
    rejectionReason: "La titularidad no coincide con el DNI informado.",
  });
  const usdBank = await ensurePaymentMethod({
    clientId: usdClient.id,
    type: "bank_account",
    currency: "USD",
    detail: "IBAN US64 AUCT 0000 7788",
    bank: "Bank of America",
    countryId: 6,
    status: "verified",
  });

  await ensurePayoutAccount({
    ownerId: mariaOwner.id,
    bank: "Banco Nacion",
    countryId: 1,
    currency: "ARS",
    cbuOrIban: "0000003100012345678901",
    accountHolder: "Maria Coleccionista",
    declaredAt: daysFromNow(-15),
  });
  await ensurePayoutAccount({
    ownerId: estateOwner.id,
    bank: "Banco Galicia",
    countryId: 1,
    currency: "ARS",
    cbuOrIban: "0000007900098765432109",
    accountHolder: "Sucesion Lacroze",
    declaredAt: daysFromNow(-40),
  });
  await ensurePayoutAccount({
    ownerId: galleryOwner.id,
    bank: "Banco Republica",
    countryId: 2,
    currency: "USD",
    cbuOrIban: "UY12 BROU 0000 2222 3333 4444",
    accountHolder: "Galeria Rio de la Plata",
    declaredAt: daysFromNow(2),
  });

  const livePolicy = await ensureInsurance({
    policyNumber: "POL-2026-0001",
    company: "La Segunda Seguros",
    combinedPolicy: true,
    amount: 850_000,
  });
  const estatePolicy = await ensureInsurance({
    policyNumber: "POL-2026-0142",
    company: "Zurich Argentina",
    combinedPolicy: false,
    amount: 1_200_000,
  });
  const usdPolicy = await ensureInsurance({
    policyNumber: "POL-USD-2026-0099",
    company: "Chubb Fine Art",
    combinedPolicy: false,
    amount: 75_000,
  });

  const liveAuction = await ensureAuction({
    startsAt: daysFromNow(0, -2),
    status: "open",
    currency: "ARS",
    category: "silver",
    auctioneerId: admin.id,
    location: "Auctify Live Room - Junio 2026",
    attendeeCapacity: 120,
    hasWarehouse: true,
    ownSecurity: true,
    streamingUrl: "https://stream.auctify.example/live/junio-2026",
  });
  const scheduledAuction = await ensureAuction({
    startsAt: daysFromNow(5, 3),
    status: "scheduled",
    currency: "USD",
    category: "gold",
    auctioneerId: admin.id,
    location: "Auctify USD Preview - Arte Internacional",
    attendeeCapacity: 80,
    hasWarehouse: true,
    ownSecurity: true,
    streamingUrl: "https://stream.auctify.example/live/usd-preview",
  });
  const closedAuction = await ensureAuction({
    startsAt: daysFromNow(-20, -1),
    status: "closed",
    currency: "ARS",
    category: "common",
    auctioneerId: admin.id,
    location: "Auctify Archivo - Abril 2026",
    attendeeCapacity: 100,
    hasWarehouse: true,
    ownSecurity: false,
  });
  const collectionAuction = await ensureAuction({
    startsAt: daysFromNow(10, 2),
    status: "scheduled",
    currency: "ARS",
    category: "platinum",
    auctioneerId: admin.id,
    location: "Auctify Coleccion Lacroze - Julio 2026",
    attendeeCapacity: 50,
    hasWarehouse: true,
    ownSecurity: true,
    isCollection: true,
    collectionName: "Coleccion privada Lacroze",
  });

  const liveCatalog = await ensureCatalog(
    liveAuction.id,
    "Catalogo de Arte y Diseno Argentino - Junio 2026",
    admin.id
  );
  const scheduledCatalog = await ensureCatalog(
    scheduledAuction.id,
    "International Fine Art Preview - USD",
    admin.id
  );
  const closedCatalog = await ensureCatalog(
    closedAuction.id,
    "Resultados seleccionados - Abril 2026",
    admin.id
  );
  const collectionCatalog = await ensureCatalog(
    collectionAuction.id,
    "Coleccion Lacroze: mobiliario, plateria y documentos",
    admin.id
  );

  const liveProducts = [
    await ensureProduct({
      ownerId: mariaOwner.id,
      fullDescription: "Oleo sobre tela de gran formato con paisaje pampeano y marco original restaurado.",
      catalogDescription: "Paisaje pampeano, escuela argentina, c. 1950",
      artist: "Ana Weiss",
      historicalDate: "c. 1950",
      history: "Procedencia familiar documentada en provincia de Buenos Aires.",
      insurancePolicy: livePolicy.policyNumber,
      reviewerId: admin.id,
      photos: photoSeed("paisaje-pampeano"),
      location: {
        warehouse: "Deposito Auctify Norte - Sector A3",
        address: "Av. Del Libertador 7200, CABA",
        receivedAt: daysFromNow(-7),
      },
    }),
    await ensureProduct({
      ownerId: mariaOwner.id,
      fullDescription: "Escultura en bronce patinado sobre base de marmol negro, firmada en la base.",
      catalogDescription: "Escultura en bronce patinado, figura femenina",
      artist: "Rogelio Yrurtia",
      historicalDate: "c. 1935",
      history: "Adquirida en galeria portena durante la decada de 1980.",
      insurancePolicy: livePolicy.policyNumber,
      reviewerId: admin.id,
      photos: photoSeed("bronce-yrurtia"),
      location: {
        warehouse: "Deposito Auctify Norte - Sector B1",
        address: "Av. Del Libertador 7200, CABA",
        receivedAt: daysFromNow(-6),
      },
    }),
    await ensureProduct({
      ownerId: estateOwner.id,
      fullDescription: "Juego de te de plata 925 con bandeja, tetera, cafetera, lechera y azucarera.",
      catalogDescription: "Juego de te de plata 925, 5 piezas",
      pieceCount: 5,
      artist: "Plateria Lopez",
      historicalDate: "c. 1940",
      insurancePolicy: estatePolicy.policyNumber,
      reviewerId: admin.id,
      photos: photoSeed("plata-lopez"),
      location: {
        warehouse: "Deposito Auctify Norte - Caja fuerte 2",
        address: "Av. Del Libertador 7200, CABA",
        receivedAt: daysFromNow(-5),
      },
    }),
    await ensureProduct({
      ownerId: mariaOwner.id,
      fullDescription: "Alfombra persa de lana anudada a mano, campo central azul y guarda floral.",
      catalogDescription: "Alfombra persa Kashan, lana, 310 x 210 cm",
      historicalDate: "mediados s. XX",
      reviewerId: admin.id,
      photos: photoSeed("alfombra-kashan"),
      location: {
        warehouse: "Deposito Auctify Norte - Sector Textiles",
        address: "Av. Del Libertador 7200, CABA",
        receivedAt: daysFromNow(-4),
      },
    }),
  ];

  const liveItems = [
    await ensureCatalogItem({
      catalogId: liveCatalog.id,
      productId: liveProducts[0].id,
      lotNumber: 1,
      basePrice: 150_000,
      commission: 0.1,
      status: "active",
      insurancePolicy: livePolicy.policyNumber,
    }),
    await ensureCatalogItem({
      catalogId: liveCatalog.id,
      productId: liveProducts[1].id,
      lotNumber: 2,
      basePrice: 260_000,
      commission: 0.12,
      status: "pending",
      insurancePolicy: livePolicy.policyNumber,
    }),
    await ensureCatalogItem({
      catalogId: liveCatalog.id,
      productId: liveProducts[2].id,
      lotNumber: 3,
      basePrice: 420_000,
      commission: 0.11,
      status: "pending",
      insurancePolicy: estatePolicy.policyNumber,
    }),
    await ensureCatalogItem({
      catalogId: liveCatalog.id,
      productId: liveProducts[3].id,
      lotNumber: 4,
      basePrice: 95_000,
      commission: 0.08,
      status: "pending",
    }),
  ];

  await prisma.auction.update({
    where: { id: liveAuction.id },
    data: { currentItemId: liveItems[0].id },
  });

  const scheduledProduct = await ensureProduct({
    ownerId: galleryOwner.id,
    fullDescription: "Acrylic on canvas, signed lower right, exhibited in Montevideo and Miami.",
    catalogDescription: "Constructive abstraction, acrylic on canvas",
    artist: "Carmen Herrera",
    historicalDate: "1987",
    insurancePolicy: usdPolicy.policyNumber,
    reviewerId: admin.id,
    photos: photoSeed("usd-abstraction"),
    location: {
      warehouse: "Auctify Bonded Storage - Sector USD",
      address: "Av. Del Libertador 7200, CABA",
      receivedAt: daysFromNow(-3),
    },
  });
  await ensureCatalogItem({
    catalogId: scheduledCatalog.id,
    productId: scheduledProduct.id,
    lotNumber: 1,
    basePrice: 18_000,
    commission: 0.15,
    status: "pending",
    insurancePolicy: usdPolicy.policyNumber,
  });

  const collectionProducts = [
    await ensureProduct({
      ownerId: estateOwner.id,
      fullDescription: "Escritorio frances estilo Luis XV con marqueteria floral y herrajes de bronce.",
      catalogDescription: "Escritorio Luis XV con marqueteria",
      historicalDate: "fines s. XIX",
      insurancePolicy: estatePolicy.policyNumber,
      reviewerId: admin.id,
      photos: photoSeed("lacroze-escritorio"),
      location: {
        warehouse: "Deposito Auctify Norte - Sector Muebles",
        address: "Av. Del Libertador 7200, CABA",
        receivedAt: daysFromNow(-2),
      },
    }),
    await ensureProduct({
      ownerId: estateOwner.id,
      fullDescription: "Archivo epistolar familiar con documentos historicos y fotografias albuminadas.",
      catalogDescription: "Archivo epistolar y fotografico Lacroze",
      pieceCount: 42,
      historicalDate: "1890-1930",
      insurancePolicy: estatePolicy.policyNumber,
      reviewerId: admin.id,
      photos: photoSeed("lacroze-archivo"),
      location: {
        warehouse: "Deposito Auctify Norte - Documentos",
        address: "Av. Del Libertador 7200, CABA",
        receivedAt: daysFromNow(-2),
      },
    }),
  ];
  await ensureCatalogItem({
    catalogId: collectionCatalog.id,
    productId: collectionProducts[0].id,
    lotNumber: 1,
    basePrice: 1_050_000,
    commission: 0.13,
    status: "pending",
    insurancePolicy: estatePolicy.policyNumber,
  });
  await ensureCatalogItem({
    catalogId: collectionCatalog.id,
    productId: collectionProducts[1].id,
    lotNumber: 2,
    basePrice: 680_000,
    commission: 0.12,
    status: "pending",
    insurancePolicy: estatePolicy.policyNumber,
  });

  const closedProducts = [
    await ensureProduct({
      ownerId: goldOwner.id,
      fullDescription: "Reloj de mesa Art Deco con caja de marmol y maquinaria revisada.",
      catalogDescription: "Reloj Art Deco de mesa",
      historicalDate: "c. 1930",
      reviewerId: admin.id,
      photos: photoSeed("closed-reloj"),
    }),
    await ensureProduct({
      ownerId: mariaOwner.id,
      fullDescription: "Grabado firmado y numerado, edicion 18/80, papel con sello seco.",
      catalogDescription: "Grabado firmado, edicion limitada",
      artist: "Antonio Berni",
      historicalDate: "1972",
      reviewerId: admin.id,
      photos: photoSeed("closed-berni"),
    }),
    await ensureProduct({
      ownerId: estateOwner.id,
      fullDescription: "Lote de cristaleria europea con faltantes menores.",
      catalogDescription: "Cristaleria europea, lote mixto",
      pieceCount: 18,
      reviewerId: admin.id,
      photos: photoSeed("closed-cristal"),
    }),
  ];
  const closedItems = [
    await ensureCatalogItem({
      catalogId: closedCatalog.id,
      productId: closedProducts[0].id,
      lotNumber: 1,
      basePrice: 60_000,
      commission: 0.1,
      status: "sold",
      auctioned: true,
    }),
    await ensureCatalogItem({
      catalogId: closedCatalog.id,
      productId: closedProducts[1].id,
      lotNumber: 2,
      basePrice: 85_000,
      commission: 0.1,
      status: "sold",
      auctioned: true,
    }),
    await ensureCatalogItem({
      catalogId: closedCatalog.id,
      productId: closedProducts[2].id,
      lotNumber: 3,
      basePrice: 45_000,
      commission: 0.08,
      status: "unsold",
      auctioned: true,
    }),
  ];

  const goldAttendee = await ensureAttendee(liveAuction.id, goldClient.id, 12);
  const silverAttendee = await ensureAttendee(liveAuction.id, silverClient.id, 18);
  await ensureAttendee(liveAuction.id, commonClient.id, 31);
  await ensureActiveSession(liveAuction.id, goldClient.id, daysFromNow(0, -1));
  await ensureActiveSession(liveAuction.id, silverClient.id, daysFromNow(0, -1));

  await ensureAuctionEvent(liveAuction.id, "item_opened", { itemId: liveItems[0].id, lotNumber: 1 }, daysFromNow(0, -1));
  const liveBid1 = await ensureBid({
    itemId: liveItems[0].id,
    attendeeId: silverAttendee.id,
    paymentMethodId: silverBankArs.id,
    amount: 150_000,
    idempotencyKey: "seed-live-lot1-silver-150000",
    timestamp: daysFromNow(0, -1),
  });
  await ensureAuctionEvent(
    liveAuction.id,
    "new_bid",
    { bidId: liveBid1.id, itemId: liveItems[0].id, amount: 150_000, attendeeId: silverAttendee.id, bidderNumber: silverAttendee.bidderNumber },
    daysFromNow(0, -1)
  );
  const liveBid2 = await ensureBid({
    itemId: liveItems[0].id,
    attendeeId: goldAttendee.id,
    paymentMethodId: goldBankArs.id,
    amount: 165_000,
    idempotencyKey: "seed-live-lot1-gold-165000",
    timestamp: daysFromNow(0, -1),
  });
  await ensureAuctionEvent(
    liveAuction.id,
    "new_bid",
    { bidId: liveBid2.id, itemId: liveItems[0].id, amount: 165_000, attendeeId: goldAttendee.id, bidderNumber: goldAttendee.bidderNumber },
    daysFromNow(0, -1)
  );
  const liveBid3 = await ensureBid({
    itemId: liveItems[0].id,
    attendeeId: silverAttendee.id,
    paymentMethodId: silverBankArs.id,
    amount: 174_000,
    idempotencyKey: "seed-live-lot1-silver-174000",
    timestamp: daysFromNow(0, -1),
  });
  await ensureAuctionEvent(
    liveAuction.id,
    "new_bid",
    { bidId: liveBid3.id, itemId: liveItems[0].id, amount: 174_000, attendeeId: silverAttendee.id, bidderNumber: silverAttendee.bidderNumber },
    daysFromNow(0, -1)
  );
  const liveBid4 = await ensureBid({
    itemId: liveItems[0].id,
    attendeeId: goldAttendee.id,
    paymentMethodId: goldCardArs.id,
    amount: 188_000,
    idempotencyKey: "seed-live-lot1-gold-188000",
    timestamp: daysFromNow(0, -1),
  });
  await ensureAuctionEvent(
    liveAuction.id,
    "new_bid",
    { bidId: liveBid4.id, itemId: liveItems[0].id, amount: 188_000, attendeeId: goldAttendee.id, bidderNumber: goldAttendee.bidderNumber },
    daysFromNow(0, -1)
  );
  await syncBidWinners(liveItems[0].id);

  const closedGoldAttendee = await ensureAttendee(closedAuction.id, goldClient.id, 4);
  const closedBlockedAttendee = await ensureAttendee(closedAuction.id, blockedClient.id, 9);
  const soldBid = await ensureBid({
    itemId: closedItems[0].id,
    attendeeId: closedGoldAttendee.id,
    paymentMethodId: goldBankArs.id,
    amount: 78_000,
    idempotencyKey: "seed-closed-lot1-gold-78000",
    timestamp: daysFromNow(-20, 2),
  });
  await ensureBid({
    itemId: closedItems[1].id,
    attendeeId: closedBlockedAttendee.id,
    paymentMethodId: blockedCheck.id,
    amount: 120_000,
    idempotencyKey: "seed-closed-lot2-blocked-120000",
    timestamp: daysFromNow(-20, 3),
  });
  await syncBidWinners(closedItems[0].id);
  await syncBidWinners(closedItems[1].id);

  await ensureAuctionEvent(closedAuction.id, "item_sold", { itemId: closedItems[0].id, amount: 78_000, winnerClientId: goldClient.id }, daysFromNow(-20, 2));
  await ensureAuctionEvent(closedAuction.id, "item_sold", { itemId: closedItems[1].id, amount: 120_000, winnerClientId: blockedClient.id }, daysFromNow(-20, 3));
  await ensureAuctionEvent(closedAuction.id, "item_unsold", { itemId: closedItems[2].id, amount: 45_000, boughtByCompany: true }, daysFromNow(-20, 4));
  await ensureAuctionEvent(closedAuction.id, "auction_ended", { auctionId: closedAuction.id }, daysFromNow(-20, 5));

  const paidSale = await ensureSaleRecord({
    auctionId: closedAuction.id,
    ownerId: goldOwner.id,
    productId: closedProducts[0].id,
    clientId: goldClient.id,
    amount: 78_000,
    commission: 7_800,
    paymentMethodId: goldBankArs.id,
    shippingCost: 4_500,
    pickupInPerson: false,
    shippingAddress: "Calle Falsa 123, Buenos Aires",
    paymentStatus: "paid",
    paidAt: daysFromNow(-19),
    createdAt: daysFromNow(-20, 2),
  });

  const failedSale = await ensureSaleRecord({
    auctionId: closedAuction.id,
    ownerId: mariaOwner.id,
    productId: closedProducts[1].id,
    clientId: blockedClient.id,
    amount: 120_000,
    commission: 12_000,
    paymentMethodId: blockedCheck.id,
    pickupInPerson: true,
    insuranceCovered: false,
    paymentStatus: "failed",
    createdAt: daysFromNow(-20, 3),
  });

  await ensureSaleRecord({
    auctionId: closedAuction.id,
    ownerId: estateOwner.id,
    productId: closedProducts[2].id,
    clientId: null,
    amount: 45_000,
    commission: 0,
    paymentMethodId: null,
    boughtByCompany: true,
    paymentStatus: "pending",
    createdAt: daysFromNow(-20, 4),
  });

  await ensurePenalty({
    clientId: blockedClient.id,
    auctionId: closedAuction.id,
    itemId: closedItems[1].id,
    amount: failedSale.amount * 0.1,
    status: "pending",
    dueAt: daysFromNow(-17),
    createdAt: daysFromNow(-19),
  });

  const inclusionProducts = [
    await ensureProduct({
      ownerId: goldOwner.id,
      fullDescription: "Mesa de roble macizo con tapa extensible, marcas de uso propias de la epoca.",
      catalogDescription: "Mesa de roble macizo s. XIX",
      available: false,
      historicalDate: "s. XIX",
      photos: photoSeed("inclusion-pending"),
    }),
    await ensureProduct({
      ownerId: goldOwner.id,
      fullDescription: "Lampara italiana de pie con tulipa opalina y base cromada.",
      catalogDescription: "Lampara italiana de pie",
      available: false,
      historicalDate: "c. 1960",
      photos: photoSeed("inclusion-inspection"),
    }),
    await ensureProduct({
      ownerId: mariaOwner.id,
      fullDescription: "Acuarela costumbrista firmada, papel con leve oxidacion marginal.",
      catalogDescription: "Acuarela costumbrista firmada",
      available: false,
      artist: "Prilidiano Pueyrredon",
      photos: photoSeed("inclusion-proposal"),
    }),
    await ensureProduct({
      ownerId: estateOwner.id,
      fullDescription: "Sillon frailero en nogal con cuero repujado, restauracion profesional.",
      catalogDescription: "Sillon frailero en nogal",
      available: true,
      historicalDate: "s. XVIII",
      insurancePolicy: estatePolicy.policyNumber,
      photos: photoSeed("inclusion-accepted"),
      location: {
        warehouse: "Deposito Auctify Norte - Sector Muebles",
        address: "Av. Del Libertador 7200, CABA",
        receivedAt: daysFromNow(-8),
      },
    }),
    await ensureProduct({
      ownerId: galleryOwner.id,
      fullDescription: "Serigrafia sin documentacion suficiente de origen ni trazabilidad comercial.",
      catalogDescription: "Serigrafia contemporanea sin documentacion",
      available: false,
      photos: photoSeed("inclusion-rejected"),
    }),
    await ensureProduct({
      ownerId: mariaOwner.id,
      fullDescription: "Juego de porcelana incompleto con decoracion floral azul cobalto.",
      catalogDescription: "Juego de porcelana incompleto",
      available: false,
      pieceCount: 14,
      photos: photoSeed("inclusion-proposal-rejected"),
    }),
  ];

  await ensureInclusionRequest({
    ownerId: goldOwner.id,
    productId: inclusionProducts[0].id,
    itemDescription: "Mesa de roble para evaluar en proxima subasta de mobiliario.",
    ownershipDeclared: true,
    legalityDeclared: true,
    status: "pending",
    createdAt: daysFromNow(-5),
  });
  await ensureInclusionRequest({
    ownerId: goldOwner.id,
    productId: inclusionProducts[1].id,
    itemDescription: "Lampara italiana pendiente de inspeccion fisica.",
    ownershipDeclared: true,
    legalityDeclared: true,
    status: "under_inspection",
    createdAt: daysFromNow(-4),
  });
  const proposalRequest = await ensureInclusionRequest({
    ownerId: mariaOwner.id,
    productId: inclusionProducts[2].id,
    itemDescription: "Acuarela propuesta para subasta de arte argentino.",
    ownershipDeclared: true,
    legalityDeclared: true,
    status: "proposal_sent",
    proposedBasePrice: 140_000,
    proposedCommission: 0.12,
    proposedAuctionId: liveAuction.id,
    createdAt: daysFromNow(-3),
  });
  await ensureInclusionRequest({
    ownerId: estateOwner.id,
    productId: inclusionProducts[3].id,
    itemDescription: "Sillon aceptado para coleccion Lacroze.",
    ownershipDeclared: true,
    legalityDeclared: true,
    status: "accepted",
    proposedBasePrice: 390_000,
    proposedCommission: 0.12,
    proposedAuctionId: collectionAuction.id,
    createdAt: daysFromNow(-9),
  });
  const rejectedRequest = await ensureInclusionRequest({
    ownerId: galleryOwner.id,
    productId: inclusionProducts[4].id,
    itemDescription: "Serigrafia rechazada por falta de documentacion.",
    ownershipDeclared: true,
    legalityDeclared: true,
    status: "rejected",
    rejectionReason: "No se pudo validar la procedencia declarada.",
    returnShippingCost: 7_500,
    createdAt: daysFromNow(-7),
  });
  await ensureInclusionRequest({
    ownerId: mariaOwner.id,
    productId: inclusionProducts[5].id,
    itemDescription: "Porcelana con propuesta rechazada por la dueña.",
    ownershipDeclared: true,
    legalityDeclared: true,
    status: "proposal_rejected",
    proposedBasePrice: 65_000,
    proposedCommission: 0.1,
    proposedAuctionId: liveAuction.id,
    returnShippingCost: 5_200,
    createdAt: daysFromNow(-6),
  });

  await ensureNotification({
    clientId: pendingClient.id,
    type: "admission",
    title: "Solicitud recibida",
    message: "Estamos revisando tu documentacion para admitirte como postor.",
    payload: { document: pendingClient.document },
    createdAt: daysFromNow(-2),
  });
  await ensureNotification({
    clientId: activationClient.id,
    type: "admission",
    title: "Cuenta admitida",
    message: "Tu cuenta fue admitida. Activa el acceso con el token de desarrollo.",
    payload: { activationToken: "act_seed_nicolas_suarez_2026" },
    createdAt: daysFromNow(-1),
  });
  await ensureNotification({
    clientId: goldClient.id,
    type: "auction_winner",
    title: "Ganaste un item",
    message: "Felicitaciones, ganaste el Reloj Art Deco de mesa.",
    read: true,
    payload: { saleRecordId: paidSale.id, bidId: soldBid.id, amount: 78_000 },
    createdAt: daysFromNow(-19),
  });
  await ensureNotification({
    clientId: blockedClient.id,
    type: "penalty",
    title: "Multa generada",
    message: "No se pudo completar el pago de tu compra y tu cuenta quedo bloqueada.",
    payload: { saleRecordId: failedSale.id, penaltyAmount: failedSale.amount * 0.1 },
    createdAt: daysFromNow(-18),
  });
  await ensureNotification({
    clientId: ownerClient.id,
    type: "inclusion_proposal",
    title: "Propuesta de inclusion",
    message: "Recibiste una propuesta para la acuarela costumbrista.",
    payload: { inclusionRequestId: proposalRequest.id, proposedBasePrice: 140_000 },
    createdAt: daysFromNow(-2),
  });
  await ensureNotification({
    clientId: ownerClient.id,
    type: "info",
    title: "Recordatorio de cuenta de cobro",
    message: "Verifica que tu cuenta de cobro este declarada antes del inicio de la subasta.",
    payload: { ownerId: mariaOwner.id },
    createdAt: daysFromNow(-1),
  });
  await ensureNotification({
    clientId: estateClient.id,
    type: "info",
    title: "Bien recibido en deposito",
    message: "El sillon frailero fue recibido y asegurado en el deposito.",
    payload: { productId: inclusionProducts[3].id, policyNumber: estatePolicy.policyNumber },
    createdAt: daysFromNow(-7),
  });
  await ensureNotification({
    clientId: admin.id,
    type: "item_rejected",
    title: "Inclusion rechazada",
    message: "La serigrafia fue rechazada y debe coordinarse su devolucion.",
    payload: { inclusionRequestId: rejectedRequest.id, returnShippingCost: 7_500 },
    createdAt: daysFromNow(-6),
  });

  await syncAuctionVersion(liveAuction.id);
  await syncAuctionVersion(closedAuction.id);
  await syncAuctionVersion(scheduledAuction.id);
  await syncAuctionVersion(collectionAuction.id);

  const counts = await Promise.all([
    prisma.client.count(),
    prisma.owner.count(),
    prisma.auction.count(),
    prisma.catalogItem.count(),
    prisma.bid.count(),
    prisma.saleRecord.count(),
    prisma.inclusionRequest.count(),
    prisma.notification.count(),
    prisma.penalty.count(),
  ]);

  console.log("");
  console.log("Seed Auctify completado.");
  console.log(`Clientes: ${counts[0]} | Duenios: ${counts[1]} | Subastas: ${counts[2]} | Lotes: ${counts[3]}`);
  console.log(`Pujas: ${counts[4]} | Ventas: ${counts[5]} | Inclusiones: ${counts[6]} | Notificaciones: ${counts[7]} | Multas: ${counts[8]}`);
  console.log("");
  console.log("Credenciales demo:");
  console.log(`  ADMIN        DNI 00000001 / ${PASSWORDS.admin} / platinum`);
  console.log(`  POSTOR GOLD  DNI 30111222 / ${PASSWORDS.bidder} / gold`);
  console.log(`  POSTOR SILV  DNI 30222333 / ${PASSWORDS.silver} / silver`);
  console.log(`  DUENIA       DNI 20333444 / ${PASSWORDS.owner} / owner demo`);
  console.log(`  USD BIDDER   DNI 30777888 / ${PASSWORDS.usd} / gold USD`);
  console.log("  ACTIVACION   token act_seed_nicolas_suarez_2026 para DNI 30888999");
  console.log("");
}

main()
  .catch((error) => {
    console.error("Error en seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
