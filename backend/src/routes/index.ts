/**
 * Router principal /v1
 * Monta todos los módulos del API.
 *
 * Para agregar un nuevo módulo:
 *   1. Crear src/modules/<nombre>/<nombre>.routes.ts
 *   2. Importarlo aquí y montarlo con router.use(...)
 */

import { Router } from "express";
import healthRouter from "../modules/health/health.routes";
import authRouter from "../modules/auth/auth.routes";
import clientsRouter from "../modules/clients/clients.routes";
import paymentMethodsRouter from "../modules/paymentMethods/paymentMethods.routes";
import auctionsRouter from "../modules/auctions/auctions.routes";
import itemsRouter from "../modules/items/items.routes";
import penaltiesRouter from "../modules/penalties/penalties.routes";
import saleRecordsRouter from "../modules/sale-records/sale-records.routes";
import insuranceRouter from "../modules/insurance/insurance.routes";
import productsRouter from "../modules/products/products.routes";
import ownersRouter from "../modules/owners/owners.routes";
import inclusionRequestsRouter from "../modules/inclusion-requests/inclusion-requests.routes";
import metricsRouter from "../modules/metrics/metrics.routes";
import notificationsRouter from "../modules/notifications/notifications.routes";
import countriesRouter from "../modules/countries/countries.routes";
import * as itemsController from "../modules/items/items.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

// ── Health ────────────────────────────────────────────────────────────────────
router.use("/health", healthRouter);

// ── Auth (F01) ────────────────────────────────────────────────────────────────
router.use("/auth", authRouter);

// ── Clients (admin) ───────────────────────────────────────────────────────────
router.use("/clients", clientsRouter);

// ── Countries ─────────────────────────────────────────────────────────────────
router.use("/countries", countriesRouter);

// ── Payment Methods (F02) ─────────────────────────────────────────────────────
// Paths completos (/me/payment-methods, /payment-methods/:id) → montado en la raíz /v1.
router.use(paymentMethodsRouter);

// ── Auctions · Catálogo · Sesión · Live (F03/F04) ────────────────────────────
router.use("/auctions", auctionsRouter);

// ── Items / Bids (F03/F05) ────────────────────────────────────────────────────
router.use("/items", itemsRouter);

// ── Mis pujas (F05) — listado de pujas del cliente actual ──────────────────────
router.get("/me/bids", requireAuth, itemsController.listMyBids);

// ── Sale Records (F07) ────────────────────────────────────────────────────────
// GET  /sale-records
// POST /sale-records (admin/system)
// PATCH /sale-records/:id/shipping
// POST  /sale-records/:id/pay
router.use("/sale-records", saleRecordsRouter);

// ── Insurance (F11) ───────────────────────────────────────────────────────────
// GET  /insurance/:policyNumber
// POST /insurance/:policyNumber/coverage-increase
router.use("/insurance", insuranceRouter);

// ── Products (F06/F11) ────────────────────────────────────────────────────────
// POST /products, GET /products, POST /products/:id/photos (F06)
// GET  /products/:id/location (F11)
router.use("/products", productsRouter);

// ── Owners (F11 — cuentas de cobro) ──────────────────────────────────────────
// GET  /owners/:id/payout-accounts
// POST /owners/:id/payout-accounts
router.use("/owners", ownersRouter);

// ── Penalties (F10) ───────────────────────────────────────────────────────────
// Paths completos (/penalties, /me/penalties, /clients/:id/penalties, /penalties/:id/pay) → raíz /v1.
router.use(penaltiesRouter);

// ── Inclusion Requests (F06) ──────────────────────────────────────────────────
// POST /inclusion-requests, GET /inclusion-requests, GET /inclusion-requests/:id
// POST /inclusion-requests/:id/inspection (admin)
// POST /inclusion-requests/:id/owner-response (owner)
router.use("/inclusion-requests", inclusionRequestsRouter);

// ── Notifications (F09) ───────────────────────────────────────────────────────
// GET /me/notifications, POST /notifications/:id/read
router.use("/", notificationsRouter);

// ── Metrics (F08) ─────────────────────────────────────────────────────────────
// GET /me/metrics, GET /clients/:id/metrics (admin)
router.use("/", metricsRouter);

export default router;
