/**
 * Rutas del módulo items/bids.
 * Base path: /v1/items (montado en routes/index.ts)
 *
 * GET  /items              — listar ítems (optionalAuth para basePrice)
 * GET  /items/:id          — detalle (optionalAuth)
 * POST /items              — crear ítem en catálogo (ADMIN)
 * PATCH /items/:id         — actualizar ítem (ADMIN)
 * GET  /items/:id/bids     — historial de pujas (requireAuth)
 * POST /items/:id/bids     — crear puja (requireAuth; header Idempotency-Key)
 *
 */

import { Router } from "express";
import { validate } from "../../middleware/validate";
import { requireAuth, optionalAuth, requireRole } from "../../middleware/auth";
import {
  listItemsSchema,
  itemIdSchema,
  createItemSchema,
  updateItemSchema,
  createBidSchema,
} from "./items.schema";
import * as ctrl from "./items.controller";

const router = Router();

// ── Ítems (optionalAuth: basePrice visible solo a autenticados) ───────────────

router.get("/", optionalAuth, validate(listItemsSchema), ctrl.listItems);

router.get("/:id", optionalAuth, validate(itemIdSchema), ctrl.getItem);

// ── Admin CRUD ────────────────────────────────────────────────────────────────

router.post("/", requireAuth, requireRole("ADMIN"), validate(createItemSchema), ctrl.createItem);

router.patch("/:id", requireAuth, requireRole("ADMIN"), validate(updateItemSchema), ctrl.updateItem);

// ── Historial de pujas ────────────────────────────────────────────────────────

router.get(
  "/:id/bids",
  requireAuth,
  validate(itemIdSchema),
  ctrl.listBids
);

// ── Crear puja ────────────────────────────────────────────────────────────────

/**
 * POST /items/:id/bids
 * Requiere header Idempotency-Key.
 * Body: { amount, paymentMethodId, knownBestBid? }
 * La identidad del postor (attendeeId) se resuelve del token.
 */
router.post(
  "/:id/bids",
  requireAuth,
  validate(createBidSchema),
  ctrl.createBid
);

export default router;
