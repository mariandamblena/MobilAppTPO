/**
 * Schemas zod de validación del módulo items/bids.
 */

import { z } from "zod";

/** ID numérico en params de ruta. */
const numericId = z
  .string()
  .regex(/^\d+$/, "ID debe ser un número")
  .transform(Number);

/** GET /items — filtros opcionales. */
export const listItemsSchema = z.object({
  query: z.object({
    catalogId: z
      .string()
      .regex(/^\d+$/, "catalogId debe ser un número")
      .transform(Number)
      .optional(),
    auctionId: z
      .string()
      .regex(/^\d+$/, "auctionId debe ser un número")
      .transform(Number)
      .optional(),
    auctioned: z
      .string()
      .optional()
      .transform((v) => {
        if (v === "true") return true;
        if (v === "false") return false;
        return undefined;
      }),
  }),
});

/** Params con :id numérico. */
export const itemIdSchema = z.object({
  params: z.object({ id: numericId }),
});

/** POST /items — crear ítem en catálogo (admin). */
export const createItemSchema = z.object({
  body: z.object({
    catalogId: z.number().int(),
    productId: z.number().int(),
    lotNumber: z.number().int(),
    basePrice: z.number().positive(),
    commission: z.number().min(0).max(1),
    status: z.string().optional(),
  }),
});

/** PATCH /items/:id — actualizar ítem (admin). */
export const updateItemSchema = z.object({
  params: z.object({ id: numericId }),
  body: z.object({
    lotNumber: z.number().int().optional(),
    basePrice: z.number().positive().optional(),
    commission: z.number().min(0).max(1).optional(),
    status: z.string().optional(),
    auctioned: z.boolean().optional(),
    insurancePolicy: z.string().nullable().optional(),
  }),
});

/**
 * POST /items/:id/bids
 * Body: { amount, paymentMethodId }
 * Header: Idempotency-Key (obligatorio — validado en el controller, no aquí,
 *         porque los headers no forman parte del schema body/query/params).
 */
export const createBidSchema = z.object({
  params: z.object({ id: numericId }),
  body: z.object({
    amount: z
      .number({ required_error: "El importe es obligatorio", invalid_type_error: "amount debe ser un número" })
      .positive("El importe debe ser mayor a 0"),
    paymentMethodId: z
      .number({ required_error: "El medio de pago es obligatorio", invalid_type_error: "paymentMethodId debe ser un número" })
      .int()
      .positive(),
    /**
     * Versión de la puja que el cliente conocía al momento de enviar.
     * Se usa para detección optimista de BID_SUPERSEDED.
     * Es opcional: si no viene no se aplica la comprobación extra.
     */
    knownBestBid: z
      .number()
      .nullable()
      .optional(),
  }),
});
