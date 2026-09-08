/**
 * Validación de variables de entorno al arranque.
 * Si falta alguna variable crítica, el proceso falla rápido con mensaje claro.
 */

import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default("8080")
    .transform((v) => parseInt(v, 10)),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  UPLOAD_DIR: z.string().default("uploads"),
  CORS_ORIGIN: z.string().default("*"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/** Variables de entorno tipadas y validadas. */
export const env = parsed.data;

// SECURITY: en producción no se permite CORS abierto ('*'). Se mantiene
// permitido en desarrollo/test para no romper el flujo local.
if (env.NODE_ENV === "production" && env.CORS_ORIGIN === "*") {
  console.error(
    "❌ CORS_ORIGIN no puede ser '*' en producción. Configurá los orígenes permitidos."
  );
  process.exit(1);
}
