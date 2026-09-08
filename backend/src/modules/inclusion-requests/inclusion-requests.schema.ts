import { z } from "zod";

export const createInclusionRequestSchema = z.object({
  body: z.object({
    productId: z.coerce
      .number({ required_error: "productId es obligatorio" })
      .int()
      .positive(),
    itemDescription: z
      .string({ required_error: "La descripción del ítem es obligatoria" })
      .min(1, "La descripción no puede estar vacía"),
    // Se aceptan como booleanos; la regla DECLARATION_REQUIRED se valida en el service
    ownershipDeclared: z.coerce.boolean(),
    legalityDeclared: z.coerce.boolean(),
  }),
});

export const listInclusionRequestsSchema = z.object({
  query: z.object({
    ownerId: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .optional(),
    status: z
      .enum(["pending", "under_inspection", "accepted", "rejected", "proposal_sent", "proposal_rejected"])
      .optional(),
  }),
});

export const inspectionSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z
    .discriminatedUnion("result", [
      z.object({
        result: z.literal("rejected"),
        rejectionReason: z.string().min(1, "El motivo de rechazo es obligatorio"),
        returnShippingCost: z.coerce.number().positive("El costo de devolución es obligatorio"),
      }),
      z.object({
        result: z.literal("accepted"),
        basePrice: z.coerce.number().positive("El precio base es obligatorio"),
        commission: z.coerce.number().nonnegative("La comisión es obligatoria"),
        proposedAuctionId: z.coerce.number().int().positive().optional(),
      }),
    ]),
});

export const ownerResponseSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z.object({
    accepted: z.boolean({ required_error: "accepted es obligatorio" }),
    reason: z.string().optional(),
  }),
});

export const inclusionRequestParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
});
