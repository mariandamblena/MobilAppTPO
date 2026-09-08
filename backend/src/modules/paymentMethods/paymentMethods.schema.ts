/**
 * Schemas zod de validación del módulo paymentMethods.
 *
 * createSchema  — body de POST /me/payment-methods
 * verifySchema  — body de POST /payment-methods/:id/verify  (solo ADMIN)
 */

import { z } from "zod";

// ── Enums compartidos ────────────────────────────────────────────────────────

/** Tipos de medio de pago admitidos. */
const paymentMethodTypeEnum = z.enum(["bank_account", "credit_card", "certified_check"], {
  errorMap: () => ({
    message: "type debe ser bank_account, credit_card o certified_check",
  }),
});

/** Monedas aceptadas. */
const currencyEnum = z.enum(["ARS", "USD"], {
  errorMap: () => ({ message: "currency debe ser ARS o USD" }),
});

/** Estados válidos para la verificación. */
const verifyStatusEnum = z.enum(["verified", "rejected"], {
  errorMap: () => ({ message: "status debe ser verified o rejected" }),
});

// ── createSchema ─────────────────────────────────────────────────────────────

/**
 * Schema de alta de medio de pago (POST /me/payment-methods).
 *
 * Reglas por tipo:
 *  - bank_account    → detail (CBU/IBAN), bank recomendado
 *  - credit_card     → detail (últimos 4 dígitos / alias)
 *  - certified_check → reservedAmount > 0 requerido
 *
 * clientId NO se acepta en el body; se toma de req.auth.sub.
 */
export const createSchema = z.object({
  body: z
    .object({
      type: paymentMethodTypeEnum,
      currency: currencyEnum,
      detail: z
        .string({ required_error: "El detalle es obligatorio" })
        .min(1, "El detalle no puede estar vacío"),
      bank: z.string().optional(),
      countryId: z.number().int().positive().optional(),
      reservedAmount: z.number().positive("El monto reservado debe ser mayor a 0").optional(),
    })
    .superRefine((data, ctx) => {
      // certified_check requiere reservedAmount
      if (data.type === "certified_check" && data.reservedAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reservedAmount"],
          message: "El monto reservado es obligatorio para cheques certificados",
        });
      }
    }),
});

// ── verifySchema ─────────────────────────────────────────────────────────────

/**
 * Schema de verificación/rechazo (POST /payment-methods/:id/verify).
 * Solo ADMIN. Si status=rejected, reason es recomendable pero no obligatorio.
 */
export const verifySchema = z.object({
  body: z.object({
    status: verifyStatusEnum,
    reason: z.string().optional(),
  }),
});

// ── Tipos inferidos ──────────────────────────────────────────────────────────

export type CreatePaymentMethodInput = z.infer<typeof createSchema>["body"];
export type VerifyPaymentMethodInput = z.infer<typeof verifySchema>["body"];
