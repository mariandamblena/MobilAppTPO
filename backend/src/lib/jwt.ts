/**
 * Utilidades de JWT.
 */

import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { invalidToken } from "./errors";

/** Algoritmo de firma fijado para evitar ataques de confusión de algoritmo. */
const JWT_ALGORITHM = "HS256" as const;

/**
 * Claims del JWT de Auctify.
 * No incluye PII: el DNI (document) se resuelve desde la DB vía `sub` cuando
 * hace falta (ver src/middleware/owner.ts).
 */
export interface JwtPayload {
  /** clientId */
  sub: number;
  /** Categoría asignada al cliente */
  category: string | null;
  /** Roles del cliente: CLIENT, OWNER, ADMIN */
  roles: string[];
}

/**
 * Firma un token JWT con los claims del cliente.
 * La expiración se toma de JWT_EXPIRES_IN (por defecto 7d).
 * El algoritmo se fija a HS256 explícitamente.
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    algorithm: JWT_ALGORITHM,
  });
}

/**
 * Comprueba en runtime que el valor decodificado tiene la forma de un JwtPayload.
 * Valida `sub: number` y `roles: string[]`.
 */
function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.sub !== "number") return false;
  if (!Array.isArray(candidate.roles)) return false;
  if (!candidate.roles.every((r) => typeof r === "string")) return false;
  return true;
}

/**
 * Verifica y decodifica un JWT.
 * Solo acepta tokens firmados con HS256.
 * Lanza AppError INVALID_TOKEN si la firma es inválida, el token expiró
 * o el payload no tiene la forma esperada.
 */
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
  });

  if (!isJwtPayload(decoded)) {
    throw invalidToken();
  }

  return decoded;
}
