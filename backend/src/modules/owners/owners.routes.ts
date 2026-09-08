/**
 * Rutas del módulo owners.
 * Base path: /v1/owners (montado en routes/index.ts)
 *
 * GET  /owners                   — listar owners (solo ADMIN)
 * POST /owners                   — crear owner (solo ADMIN)
 * GET  /owners/:id               — detalle de owner (requiere auth)
 * GET  /owners/:id/payout-accounts — cuentas de cobro (existente)
 * POST /owners/:id/payout-accounts — declarar cuenta de cobro (existente)
 */

import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireAuth, requireRole } from "../../middleware/auth";
import { createOwnerSchema } from "./owners.schema";
import * as ownersController from "./owners.controller";
import * as insuranceController from "../insurance/insurance.controller";

const router = Router();

const CURRENCIES = ["ARS", "USD"] as const;

const createPayoutSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({
    bank: z.string().min(1),
    currency: z.enum(CURRENCIES),
    cbuOrIban: z.string().min(1),
    accountHolder: z.string().min(1),
    countryId: z.number().int().optional(),
  }),
});

const idParam = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
});

// ── CRUD de owners ────────────────────────────────────────────────────────────

/** GET /owners — lista todos los owners. Solo ADMIN. */
router.get("/", requireAuth, requireRole("ADMIN"), ownersController.listOwners);

/** POST /owners — crea un owner. Solo ADMIN. */
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validate(createOwnerSchema),
  ownersController.createOwner
);

/** GET /owners/:id — detalle de owner. Requiere auth. */
router.get("/:id", requireAuth, validate(idParam), ownersController.getOwner);

// ── Payout Accounts (existentes) ─────────────────────────────────────────────

/** GET /owners/:id/payout-accounts — cuentas de cobro declaradas */
router.get("/:id/payout-accounts", requireAuth, validate(idParam), insuranceController.getPayoutAccounts);

/** POST /owners/:id/payout-accounts — declarar nueva cuenta de cobro */
router.post(
  "/:id/payout-accounts",
  requireAuth,
  validate(createPayoutSchema),
  insuranceController.createPayoutAccount
);

export default router;
