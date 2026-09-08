/**
 * Rutas del módulo auth.
 * Base path: /v1/auth (montado en routes/index.ts)
 *
 * POST /register  — multipart/form-data con multer
 * POST /activate  — body JSON
 * POST /login     — body JSON
 * GET  /me        — requiere JWT
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { registerSchema, activateSchema, loginSchema } from "./auth.schema";
import * as authController from "./auth.controller";
import { env } from "../../config/env";

// ── Configuración de multer ───────────────────────────────────────────────────

// Crear el directorio de uploads si no existe
const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB por archivo
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se aceptan imágenes JPEG, PNG o WebP"));
    }
  },
});

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();

/**
 * POST /register
 * multipart/form-data — campos de texto + idCardFront + idCardBack + photo (opcional)
 */
router.post(
  "/register",
  upload.fields([
    { name: "idCardFront", maxCount: 1 },
    { name: "idCardBack", maxCount: 1 },
    { name: "photo", maxCount: 1 },
  ]),
  validate(registerSchema),
  authController.register
);

/** POST /activate — activa cuenta con token y password */
router.post("/activate", validate(activateSchema), authController.activate);

/** POST /login — devuelve JWT */
router.post("/login", validate(loginSchema), authController.login);

/** GET /me — cliente actual (requiere JWT) */
router.get("/me", requireAuth, authController.me);

export default router;
