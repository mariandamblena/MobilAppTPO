/**
 * Rutas del módulo inclusion-requests (F06).
 * Base path: /v1/inclusion-requests
 *
 * POST /inclusion-requests                        — JWT (OWNER)
 * GET  /inclusion-requests                        — JWT (OWNER/ADMIN)
 * GET  /inclusion-requests/:id                    — JWT (OWNER/ADMIN)
 * POST /inclusion-requests/:id/inspection         — JWT (ADMIN)
 * POST /inclusion-requests/:id/owner-response     — JWT (OWNER)
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { resolveOwner } from "../../middleware/owner";
import { validate } from "../../middleware/validate";
import {
  createInclusionRequestSchema,
  listInclusionRequestsSchema,
  inspectionSchema,
  ownerResponseSchema,
  inclusionRequestParamSchema,
} from "./inclusion-requests.schema";
import * as controller from "./inclusion-requests.controller";

const router = Router();

router.post(
  "/",
  requireAuth,
  resolveOwner,
  validate(createInclusionRequestSchema),
  controller.createInclusionRequest
);

router.get(
  "/",
  requireAuth,
  resolveOwner,
  validate(listInclusionRequestsSchema),
  controller.listInclusionRequests
);

router.get(
  "/:id",
  requireAuth,
  resolveOwner,
  validate(inclusionRequestParamSchema),
  controller.getInclusionRequest
);

router.post(
  "/:id/inspection",
  requireAuth,
  requireRole("ADMIN"),
  validate(inspectionSchema),
  controller.adminInspect
);

router.post(
  "/:id/owner-response",
  requireAuth,
  resolveOwner,
  validate(ownerResponseSchema),
  controller.ownerResponse
);

export default router;
