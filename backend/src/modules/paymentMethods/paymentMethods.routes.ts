/**
 * Rutas del módulo paymentMethods.
 * Se exporta un Router con RUTAS COMPLETAS (montado en /v1 en routes/index.ts).
 *
 * El dueño debe agregar en backend/src/routes/index.ts:
 *   import paymentMethodsRouter from '../modules/paymentMethods/paymentMethods.routes';
 *   router.use(paymentMethodsRouter);
 *
 * Rutas definidas:
 *   GET    /me/payment-methods           → lista del cliente autenticado
 *   POST   /me/payment-methods           → alta (status: pending)
 *   DELETE /payment-methods/:id          → baja (solo el dueño del medio)
 *   POST   /payment-methods/:id/verify   → verificar/rechazar (ADMIN; dev: sin rol)
 *
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createSchema, verifySchema } from "./paymentMethods.schema";
import * as ctrl from "./paymentMethods.controller";

const router = Router();

// ── GET /me/payment-methods ──────────────────────────────────────────────────
// JWT requerido. Devuelve los medios del cliente del token.
router.get("/me/payment-methods", requireAuth, ctrl.list);

// ── POST /me/payment-methods ─────────────────────────────────────────────────
// JWT requerido. Crea medio de pago con status "pending".
router.post("/me/payment-methods", requireAuth, validate(createSchema), ctrl.create);

// ── DELETE /payment-methods/:id ──────────────────────────────────────────────
// JWT requerido. Solo el dueño puede borrar su propio medio.
router.delete("/payment-methods/:id", requireAuth, ctrl.remove);

// ── POST /payment-methods/:id/verify ────────────────────────────────────────
// En producción → solo ADMIN.
// En desarrollo (NODE_ENV !== 'production') → se permite sin rol ADMIN para
// que el postor pueda auto-verificar y completar el circuito de pujas sin
// necesitar un usuario admin real.
if (process.env.NODE_ENV !== "production") {
  // Modo dev: requireAuth sin requireRole('ADMIN')
  router.post(
    "/payment-methods/:id/verify",
    requireAuth,
    validate(verifySchema),
    ctrl.verify
  );
} else {
  // Producción: ADMIN obligatorio
  router.post(
    "/payment-methods/:id/verify",
    requireAuth,
    requireRole("ADMIN"),
    validate(verifySchema),
    ctrl.verify
  );
}

export default router;
