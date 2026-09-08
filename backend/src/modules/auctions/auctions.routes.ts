/**
 * Rutas del módulo auctions.
 * Base path: /v1/auctions (montado en routes/index.ts)
 *
 * GET  /auctions                           — listar subastas (público)
 * GET  /auctions/:id                       — detalle (público)
 * POST /auctions                           — crear subasta (ADMIN)
 * POST /auctions/collection               — crear subasta de colección por dueño (ADMIN/dev)
 * PATCH /auctions/:id                      — actualizar subasta (ADMIN)
 * GET  /auctions/:id/catalog               — catálogo con ítems (optionalAuth para precios)
 * GET  /auctions/:id/streaming             — URL de streaming (requireAuth)
 * POST /auctions/:id/attendees             — registrarse como asistente (requireAuth)
 * GET  /auctions/:id/attendees             — listar asistentes (ADMIN)
 * POST /auctions/:id/connect               — conectarse a la sesión en vivo (requireAuth)
 * POST /auctions/:id/disconnect            — desconectarse (requireAuth)
 * GET  /auctions/:id/live-status           — estado en tiempo real (requireAuth)
 * POST /auctions/:id/items/:itemId/open    — abrir ítem (ADMIN)
 * POST /auctions/:id/items/:itemId/close   — adjudicar ítem (ADMIN)
 * POST /auctions/:id/close                 — cerrar subasta (ADMIN)
 *
 */

import { Router } from "express";
import { validate } from "../../middleware/validate";
import { requireAuth, optionalAuth, requireRole } from "../../middleware/auth";
import {
  listAuctionsSchema,
  auctionIdSchema,
  createAuctionSchema,
  updateAuctionSchema,
  registerAttendeeSchema,
  auctionItemParamsSchema,
  createCollectionAuctionSchema,
} from "./auctions.schema";
import * as ctrl from "./auctions.controller";

const router = Router();

// ── Listado y detalle (públicos) ──────────────────────────────────────────────

router.get("/", validate(listAuctionsSchema), ctrl.listAuctions);

router.get("/:id", validate(auctionIdSchema), ctrl.getAuction);

// ── Admin CRUD ────────────────────────────────────────────────────────────────

router.post("/", requireAuth, requireRole("ADMIN"), validate(createAuctionSchema), ctrl.createAuction);

/**
 * POST /auctions/collection
 * Crea una subasta de colección para todos los bienes de un dueño.
 * En dev accesible con cualquier usuario autenticado; en prod requiere ADMIN.
 */
if (process.env.NODE_ENV !== "production") {
  router.post(
    "/collection",
    requireAuth,
    validate(createCollectionAuctionSchema),
    ctrl.createCollectionAuction
  );
} else {
  router.post(
    "/collection",
    requireAuth,
    requireRole("ADMIN"),
    validate(createCollectionAuctionSchema),
    ctrl.createCollectionAuction
  );
}

router.patch("/:id", requireAuth, requireRole("ADMIN"), validate(updateAuctionSchema), ctrl.updateAuction);

// ── Catálogo de ítems ─────────────────────────────────────────────────────────

router.get("/:id/catalog", optionalAuth, validate(auctionIdSchema), ctrl.getAuctionCatalog);

// ── Streaming (clientes autenticados) ────────────────────────────────────────

router.get(
  "/:id/streaming",
  requireAuth,
  validate(auctionIdSchema),
  ctrl.getStreaming
);

// ── Asistentes ────────────────────────────────────────────────────────────────

/**
 * POST /auctions/:id/attendees
 * Self-registro: identidad del token; admin puede pasar clientId en el body.
 */
router.post(
  "/:id/attendees",
  requireAuth,
  validate(registerAttendeeSchema),
  ctrl.registerAttendee
);

/**
 * GET /auctions/:id/attendees
 * Solo ADMIN.
 */
router.get(
  "/:id/attendees",
  requireAuth,
  requireRole("ADMIN"),
  validate(auctionIdSchema),
  ctrl.listAttendees
);

// ── Sesión en vivo ────────────────────────────────────────────────────────────

/**
 * POST /auctions/:id/connect
 * Crea AuctionSession activa; auto-crea Attendee si no existe.
 * Invariante: máximo 1 sesión activa por cliente en todo el sistema.
 */
router.post(
  "/:id/connect",
  requireAuth,
  validate(auctionIdSchema),
  ctrl.connect
);

/**
 * POST /auctions/:id/disconnect
 * Cierra la sesión activa del cliente (active=false, endedAt=now).
 */
router.post(
  "/:id/disconnect",
  requireAuth,
  validate(auctionIdSchema),
  ctrl.disconnect
);

/**
 * GET /auctions/:id/live-status
 * Retorna AuctionLiveStatus. 403 NOT_CONNECTED si no hay sesión activa.
 */
router.get(
  "/:id/live-status",
  requireAuth,
  validate(auctionIdSchema),
  ctrl.getLiveStatus
);

// ── Control de la sesión en vivo (ADMIN) ──────────────────────────────────────

/**
 * POST /auctions/:id/items/:itemId/open
 * Activa un ítem del catálogo para subasta en vivo.
 * En dev también accesible sin rol ADMIN para pruebas.
 */
if (process.env.NODE_ENV !== "production") {
  router.post(
    "/:id/items/:itemId/open",
    requireAuth,
    validate(auctionItemParamsSchema),
    ctrl.openItem
  );
} else {
  router.post(
    "/:id/items/:itemId/open",
    requireAuth,
    requireRole("ADMIN"),
    validate(auctionItemParamsSchema),
    ctrl.openItem
  );
}

/**
 * POST /auctions/:id/items/:itemId/close
 * Adjudica el ítem activo al mejor postor o lo marca como unsold.
 * En dev también accesible sin rol ADMIN para pruebas.
 */
if (process.env.NODE_ENV !== "production") {
  router.post(
    "/:id/items/:itemId/close",
    requireAuth,
    validate(auctionItemParamsSchema),
    ctrl.closeItem
  );
} else {
  router.post(
    "/:id/items/:itemId/close",
    requireAuth,
    requireRole("ADMIN"),
    validate(auctionItemParamsSchema),
    ctrl.closeItem
  );
}

/**
 * POST /auctions/:id/close
 * Cierra la subasta completa (status → closed).
 * En dev también accesible sin rol ADMIN para pruebas.
 */
if (process.env.NODE_ENV !== "production") {
  router.post(
    "/:id/close",
    requireAuth,
    validate(auctionIdSchema),
    ctrl.closeAuction
  );
} else {
  router.post(
    "/:id/close",
    requireAuth,
    requireRole("ADMIN"),
    validate(auctionIdSchema),
    ctrl.closeAuction
  );
}

export default router;
