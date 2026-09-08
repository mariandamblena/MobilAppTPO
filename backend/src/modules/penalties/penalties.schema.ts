/**
 * Schemas zod de validación del módulo penalties.
 */

import { z } from "zod";

/**
 * Schema para crear una multa (POST /penalties).
 * Invocado internamente desde el service de F07 al detectar INSUFFICIENT_FUNDS,
 * o desde el endpoint en dev para testing.
 *
 * Body: { clientId, auctionId, itemId, amount }
 */
export const createSchema = z.object({
  body: z.object({
    clientId: z
      .number({ required_error: "El clientId es obligatorio" })
      .int("El clientId debe ser un entero")
      .positive("El clientId debe ser positivo"),
    auctionId: z
      .number({ required_error: "El auctionId es obligatorio" })
      .int("El auctionId debe ser un entero")
      .positive("El auctionId debe ser positivo"),
    itemId: z
      .number({ required_error: "El itemId es obligatorio" })
      .int("El itemId debe ser un entero")
      .positive("El itemId debe ser positivo"),
    amount: z
      .number({ required_error: "El amount es obligatorio" })
      .positive("El monto debe ser mayor a 0"),
  }),
});

export type CreatePenaltyInput = z.infer<typeof createSchema>["body"];
