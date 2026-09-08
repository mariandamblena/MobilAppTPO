/**
 * Middlewares de autenticación y autorización.
 *
 * Middlewares:
 *   - requireAuth          → 401 si el token falta o es inválido
 *   - optionalAuth         → puebla req.auth si el token es válido; sigue como anónimo si no
 *   - requireRole(...roles)→ 403 si el token no contiene alguno de los roles
 *   - requireSelfOrAdmin   → permite si req.auth.sub === param, o si rol ADMIN
 */

import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../lib/jwt";
import { unauthorized, forbidden } from "../lib/errors";

// ── Extensión de Express Request ─────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Payload del JWT verificado. Presente si requireAuth o optionalAuth corrió. */
      auth?: JwtPayload;
    }
  }
}

// ── Helpers internos ─────────────────────────────────────────────────────────

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

// ── Middlewares exportados ───────────────────────────────────────────────────

/**
 * Requiere JWT válido.
 * Puebla req.auth con el payload.
 * Lanza 401 UNAUTHORIZED si el token falta o es inválido.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    return next(unauthorized("Token de autenticación requerido"));
  }

  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    next(unauthorized("Token inválido o expirado"));
  }
}

/**
 * Autenticación opcional.
 * Puebla req.auth si el token es válido; si no hay token o es inválido, continúa
 * como anónimo (req.auth queda undefined). No lanza error.
 *
 * Útil para endpoints donde basePrice es visible solo a autenticados (catálogo/ítems).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (token) {
    try {
      req.auth = verifyToken(token);
    } catch {
      // Token inválido → continuar como anónimo (no fallar)
    }
  }

  next();
}

/**
 * Requiere que el usuario autenticado tenga al menos uno de los roles indicados.
 * Se usa DESPUÉS de requireAuth.
 *
 * @example
 *   router.patch("/clients/:id", requireAuth, requireRole("ADMIN"), controller.admitClient);
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(unauthorized());
    }

    const hasRole = roles.some((r) => req.auth!.roles.includes(r));
    if (!hasRole) {
      return next(
        forbidden(
          `Se requiere uno de los siguientes roles: ${roles.join(", ")}`
        )
      );
    }

    next();
  };
}

/**
 * Permite si el usuario autenticado es el mismo que el recurso (self)
 * O si tiene rol ADMIN.
 *
 * @param idParam — nombre del parámetro de ruta con el ID (ej. "id")
 *
 * @example
 *   router.get("/clients/:id/penalties", requireAuth, requireSelfOrAdmin("id"), controller.getPenalties);
 */
export function requireSelfOrAdmin(idParam: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(unauthorized());
    }

    const paramId = parseInt(req.params[idParam], 10);
    const isSelf = req.auth.sub === paramId;
    const isAdmin = req.auth.roles.includes("ADMIN");

    if (!isSelf && !isAdmin) {
      return next(
        forbidden("Solo podés acceder a tus propios recursos")
      );
    }

    next();
  };
}
