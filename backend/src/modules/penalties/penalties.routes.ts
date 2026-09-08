/**
 * Rutas del módulo penalties.
 * Se exporta un Router con RUTAS COMPLETAS (montado en /v1 en routes/index.ts).
 *
 * El dueño debe agregar en backend/src/routes/index.ts:
 *   import penaltiesRouter from '../modules/penalties/penalties.routes';
 *   router.use(penaltiesRouter);
 *
 * Rutas definidas:
 *   POST   /penalties                   → crear multa (SYSTEM; dev: sin rol ADMIN)
 *   GET    /me/penalties                → multas del cliente autenticado
 *   GET    /clients/:id/penalties       → multas de un cliente (solo ADMIN)
 *   POST   /penalties/:id/pay           → pagar multa (dueño o admin)
 *
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createSchema } from "./penalties.schema";
import * as ctrl from "./penalties.controller";

const router = Router();

// ── POST /penalties ──────────────────────────────────────────────────────────
// En producción → rol SYSTEM (simulado como ADMIN en el MVP).
// En desarrollo (NODE_ENV !== 'production') → requireAuth sin rol obligatorio
// para que se pueda generar multas de prueba sin un usuario SYSTEM real.
if (process.env.NODE_ENV !== "production") {
  // Dev: solo autenticación, sin exigir rol (permite testing sin usuario SYSTEM)
  router.post("/penalties", requireAuth, validate(createSchema), ctrl.create);
} else {
  // Producción: solo ADMIN (proxy de SYSTEM en el MVP)
  router.post(
    "/penalties",
    requireAuth,
    requireRole("ADMIN"),
    validate(createSchema),
    ctrl.create
  );
}

// ── GET /me/penalties ────────────────────────────────────────────────────────
// JWT requerido. Devuelve el historial de multas del cliente del token.
router.get("/me/penalties", requireAuth, ctrl.listMine);

// ── GET /clients/:id/penalties ───────────────────────────────────────────────
// Solo ADMIN. Permite ver las multas de cualquier cliente.
router.get(
  "/clients/:id/penalties",
  requireAuth,
  requireRole("ADMIN"),
  ctrl.listByClient
);

// ── POST /penalties/:id/pay ──────────────────────────────────────────────────
// JWT requerido. Solo el dueño de la multa o un ADMIN puede pagarla.
// El service valida ownership; el controller extrae req.auth.sub e isAdmin.
router.post("/penalties/:id/pay", requireAuth, ctrl.pay);

export default router;
