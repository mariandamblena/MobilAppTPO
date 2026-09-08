/**
 * Schemas zod de validación del módulo auctions.
 */

import { z } from "zod";

const AUCTION_STATUSES = ["scheduled", "open", "closed"] as const;
const CATEGORIES = ["common", "special", "silver", "gold", "platinum"] as const;
const CURRENCIES = ["ARS", "USD"] as const;

/** ID numérico en params de ruta. */
const numericId = z
  .string()
  .regex(/^\d+$/, "ID debe ser un número")
  .transform(Number);

/** GET /auctions — filtros opcionales. */
export const listAuctionsSchema = z.object({
  query: z.object({
    status: z.enum(AUCTION_STATUSES).optional(),
    category: z.enum(CATEGORIES).optional(),
    currency: z.enum(CURRENCIES).optional(),
    date: z
      .string()
      .optional()
      .refine((d) => !d || !isNaN(Date.parse(d)), { message: "Fecha inválida" }),
  }),
});

/** Params con :id numérico. */
export const auctionIdSchema = z.object({
  params: z.object({ id: numericId }),
});

/** POST /auctions — crear subasta (admin). */
export const createAuctionSchema = z.object({
  body: z.object({
    startsAt: z.string().min(1),
    status: z.enum(AUCTION_STATUSES).optional(),
    currency: z.enum(CURRENCIES),
    category: z.enum(CATEGORIES),
    auctioneerId: z.number().int().optional(),
    location: z.string().optional(),
    attendeeCapacity: z.number().int().optional(),
    hasWarehouse: z.boolean().optional(),
    ownSecurity: z.boolean().optional(),
    isCollection: z.boolean().optional(),
    collectionName: z.string().optional(),
    streamingUrl: z.string().optional(),
  }),
});

/** PATCH /auctions/:id — actualizar subasta (admin). */
export const updateAuctionSchema = z.object({
  params: z.object({ id: numericId }),
  body: z.object({
    startsAt: z.string().optional(),
    status: z.enum(AUCTION_STATUSES).optional(),
    currency: z.enum(CURRENCIES).optional(),
    category: z.enum(CATEGORIES).optional(),
    auctioneerId: z.number().int().nullable().optional(),
    location: z.string().nullable().optional(),
    attendeeCapacity: z.number().int().nullable().optional(),
    hasWarehouse: z.boolean().optional(),
    ownSecurity: z.boolean().optional(),
    isCollection: z.boolean().optional(),
    collectionName: z.string().nullable().optional(),
    streamingUrl: z.string().nullable().optional(),
  }),
});

/**
 * POST /auctions/:id/attendees
 * Admin puede pasar clientId en el body; si no, se ignora (se usa el del token).
 */
export const registerAttendeeSchema = z.object({
  params: z.object({ id: numericId }),
  body: z.object({
    /** Solo para admin: registrar a otro cliente. */
    clientId: z
      .number({ invalid_type_error: "clientId debe ser un número" })
      .int()
      .positive()
      .optional(),
  }),
});

/** Params con :id (auctionId) y :itemId numéricos. */
export const auctionItemParamsSchema = z.object({
  params: z.object({
    id: numericId,
    itemId: numericId,
  }),
});

/** POST /auctions/collection — crear subasta de colección para un dueño. */
export const createCollectionAuctionSchema = z.object({
  body: z.object({
    ownerId: z.number({ required_error: "ownerId es requerido" }).int().positive(),
    startsAt: z.string().min(1, "startsAt es requerido"),
    currency: z.enum(CURRENCIES),
    category: z.enum(CATEGORIES),
    productIds: z.array(z.number().int().positive()).optional(),
  }),
});
