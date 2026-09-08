/**
 * Rutas del módulo products.
 * Base path: /v1/products
 *
 * POST /products              — JWT (OWNER) — crear producto draft (F06)
 * GET  /products              — JWT (OWNER/ADMIN) — listar productos (F06)
 * POST /products/:id/photos   — JWT (OWNER) — agregar foto (F06)
 * GET  /products/:id/location — JWT — ubicación en depósito (F11)
 * GET  /products/:id          — optionalAuth — detalle de producto con fotos y location
 * PATCH /products/:id         — JWT (OWNER o ADMIN) — actualizar producto
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../../middleware/auth";
import { resolveOwner } from "../../middleware/owner";
import { validate } from "../../middleware/validate";
import { createProductSchema, listProductsSchema, updateProductSchema } from "./products.schema";
import * as productsController from "./products.controller";
import * as insuranceController from "../insurance/insurance.controller";
import { env } from "../../config/env";

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `photo-${suffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se aceptan imágenes JPEG, PNG o WebP"));
  },
});

const idParam = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
});

const router = Router();

// ── F06 — Gestión de productos (colección) ────────────────────────────────────

router.post(
  "/",
  requireAuth,
  resolveOwner,
  validate(createProductSchema),
  productsController.createProduct
);

router.get(
  "/",
  requireAuth,
  resolveOwner,
  validate(listProductsSchema),
  productsController.listProducts
);

// ── Sub-recursos de un producto (más específicos — ANTES de /:id) ─────────────

/** POST /products/:id/photos — agrega foto. Solo el dueño. */
router.post(
  "/:id/photos",
  requireAuth,
  resolveOwner,
  upload.single("photo"),
  productsController.addPhoto
);

/** GET /products/:id/location — ubicación del producto en depósito */
router.get("/:id/location", requireAuth, validate(idParam), insuranceController.getProductLocation);

// ── Detalle y actualización de un producto específico ────────────────────────

/** GET /products/:id — detalle de producto con fotos, location e insuranceDetail. */
router.get("/:id", optionalAuth, validate(idParam), productsController.getProductDetail);

/** PATCH /products/:id — actualizar producto. Solo dueño o admin. */
router.patch("/:id", requireAuth, validate(updateProductSchema), productsController.updateProduct);

export default router;
