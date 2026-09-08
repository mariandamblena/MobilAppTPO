import { z } from "zod";

export const createOwnerSchema = z.object({
  body: z.object({
    document: z
      .string({ required_error: "El documento es obligatorio" })
      .min(1, "El documento no puede estar vacío"),
    name: z
      .string({ required_error: "El nombre es obligatorio" })
      .min(1, "El nombre no puede estar vacío"),
    address: z.string().optional(),
    countryId: z.coerce.number().int().positive().optional(),
    financialVerification: z.boolean().optional(),
    judicialVerification: z.boolean().optional(),
    riskRating: z.coerce.number().int().min(1).max(6).optional(),
    verifierId: z.coerce
      .number({ required_error: "El verificador es obligatorio" })
      .int()
      .positive(),
  }),
});
