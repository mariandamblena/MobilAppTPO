import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import * as controller from "./insurance.controller";

const router = Router();

const coverageSchema = z.object({
  params: z.object({ policyNumber: z.string().min(1) }),
  body: z.object({
    newAmount: z.number().positive(),
  }),
});

/** GET /insurance/:policyNumber — ver póliza */
router.get("/:policyNumber", requireAuth, controller.getInsurance);

/** POST /insurance/:policyNumber/coverage-increase — aumentar cobertura */
router.post(
  "/:policyNumber/coverage-increase",
  requireAuth,
  validate(coverageSchema),
  controller.increaseCoverage
);

export default router;
