/**
 * Configuración de la aplicación Express.
 * Separada de index.ts para poder importarla en tests sin arrancar el servidor.
 *
 * Middlewares en orden (importante):
 *   1. cors
 *   2. express.json + urlencoded
 *   3. morgan (logging)
 *   4. /health (sin prefijo v1 — para load balancers/k8s)
 *   5. /v1 router (todos los módulos)
 *   6. notFound (404)
 *   7. errorHandler (manejo global de errores)
 */

import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env";
import v1Router from "./routes/index";
import healthRouter from "./modules/health/health.routes";
import { notFound, errorHandler } from "./middleware/error";

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(","),
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key", // requerido para pujas (ver F05-bidding.md)
    ],
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Security headers (sin dependencias — helmet no instalable en este entorno) ─
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "0");
  next();
});

// ── Rate limiting in-memory (sin dependencias — express-rate-limit no instalable) ─
function rateLimit(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || now > rec.reset) {
      hits.set(key, { count: 1, reset: now + opts.windowMs });
      return next();
    }
    rec.count += 1;
    if (rec.count > opts.max) {
      res.status(429).json({
        code: "RATE_LIMITED",
        message: "Demasiadas solicitudes. Probá de nuevo en unos minutos.",
      });
      return;
    }
    next();
  };
}
if (env.NODE_ENV !== "test") {
  app.use(rateLimit({ windowMs: 60_000, max: 2000 })); // global
  app.use("/v1/auth", rateLimit({ windowMs: 60_000, max: 300 })); // anti brute-force en login/registro
}

// ── Logging ───────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Servir archivos estáticos (uploads en desarrollo) ────────────────────────
// En producción se usa un servicio de storage externo
if (env.NODE_ENV !== "production") {
  app.use("/uploads", express.static(env.UPLOAD_DIR));
}

// ── Health sin prefijo v1 (para load balancers) ───────────────────────────────
app.use("/health", healthRouter);

// ── Router v1 ─────────────────────────────────────────────────────────────────
app.use("/v1", v1Router);

// ── 404 + Error handler (SIEMPRE al final) ────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
