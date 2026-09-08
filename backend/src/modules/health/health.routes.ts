/**
 * Rutas del health check.
 * GET /health → { status, uptime, timestamp }
 *
 * Este router se monta en AMBOS paths:
 *   - /health        (en app.ts, sin prefijo v1 — para load balancers)
 *   - /v1/health     (en routes/index.ts — para consistencia en el API)
 */

import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
