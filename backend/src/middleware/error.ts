/**
 * Middleware global de manejo de errores.
 * Convierte AppError, ZodError y errores desconocidos al envelope estándar:
 *   { code, message, details }
 *
 */

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, ErrorCode } from "../lib/errors";

/** Handler 404 — se registra ANTES del error handler. */
export function notFound(req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({
    code: ErrorCode.RESOURCE_NOT_FOUND,
    message: `Ruta no encontrada: ${req.method} ${req.path}`,
    details: null,
  });
}

/** Handler global de errores de Express. Debe ser el ÚLTIMO middleware. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // ── AppError (errores de negocio intencionados) ──────────────────────────
  if (err instanceof AppError) {
    res.status(err.httpStatus).json({
      code: err.code,
      message: err.message,
      details: err.details ?? null,
    });
    return;
  }

  // ── ZodError (validación de entrada) ────────────────────────────────────
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "body";
      fields[key] = issue.message;
    }
    res.status(400).json({
      code: ErrorCode.VALIDATION_ERROR,
      message: "Datos de entrada inválidos",
      details: { fields },
    });
    return;
  }

  // ── Error desconocido (bug, excepción no manejada) ───────────────────────
  console.error("[ErrorHandler] Error no manejado:", err);
  res.status(500).json({
    code: ErrorCode.INTERNAL_ERROR,
    message: "Algo salió mal. Intentá de nuevo más tarde.",
    details: null,
  });
}
