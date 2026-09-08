import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as controller from "./sale-records.controller";

const router = Router();

const createSchema = z.object({
  body: z.object({
    auctionId: z.number().int(),
    ownerId: z.number().int(),
    productId: z.number().int(),
    clientId: z.number().int(),
    amount: z.number().positive(),
    commission: z.number().min(0),
    shippingCost: z.number().optional(),
    pickupInPerson: z.boolean().optional(),
    paymentMethodId: z.number().int(),
    boughtByCompany: z.boolean().optional(),
  }),
});

const shippingSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({
    pickupInPerson: z.boolean(),
    shippingAddress: z.string().optional(),
  }),
});

const paySchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({
    paymentMethodId: z.number().int(),
  }),
});

/** GET /sale-records — lista de ventas (filtrada por rol) */
router.get("/", requireAuth, controller.getSaleRecords);

/** GET /sale-records/:id — detalle de una venta */
router.get("/:id", requireAuth, controller.getSaleRecordById);

/** POST /sale-records — registrar venta (solo ADMIN/SYSTEM) */
router.post("/", requireAuth, requireRole("ADMIN"), validate(createSchema), controller.createSaleRecord);

/** PATCH /sale-records/:id/shipping — elegir envío o retiro */
router.patch("/:id/shipping", requireAuth, validate(shippingSchema), controller.updateShipping);

/** POST /sale-records/:id/pay — pagar la compra */
router.post("/:id/pay", requireAuth, validate(paySchema), controller.paySaleRecord);

export default router;
