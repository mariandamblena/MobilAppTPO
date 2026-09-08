import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as controller from "./metrics.controller";

const router = Router();

// GET /me/metrics — propio cliente
router.get("/me/metrics", requireAuth, controller.getMyMetrics);

// GET /clients/:id/metrics — admin sobre cualquier cliente
router.get(
  "/clients/:id/metrics",
  requireAuth,
  requireRole("ADMIN"),
  controller.getClientMetrics
);

export default router;
