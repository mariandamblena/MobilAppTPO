import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    fullDescription: z
      .string({ required_error: "La descripción completa es obligatoria" })
      .min(1, "La descripción completa no puede estar vacía"),
    catalogDescription: z.string().optional(),
    date: z.string().optional(),
    pieceCount: z.coerce.number().int().positive().optional(),
    artist: z.string().optional(),
    historicalDate: z.string().optional(),
    history: z.string().optional(),
  }),
});

export const listProductsSchema = z.object({
  query: z.object({
    ownerId: z
      .string()
      .regex(/^\d+$/, "ownerId debe ser un número entero")
      .transform(Number)
      .optional(),
    available: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID debe ser un número").transform(Number),
  }),
  body: z.object({
    date: z.string().optional(),
    available: z.boolean().optional(),
    catalogDescription: z.string().optional(),
    fullDescription: z.string().min(1).optional(),
    reviewerId: z.coerce.number().int().positive().optional(),
    insurancePolicy: z.string().optional(),
    pieceCount: z.coerce.number().int().positive().optional(),
    artist: z.string().optional(),
    historicalDate: z.string().optional(),
    history: z.string().optional(),
  }),
});
