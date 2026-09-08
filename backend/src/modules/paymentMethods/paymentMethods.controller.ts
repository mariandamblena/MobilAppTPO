/**
 * Controlador del módulo paymentMethods.
 * Traduce requests HTTP → service → response.
 * Sin lógica de negocio — solo orquestación.
 *
 */

import { Request, Response, NextFunction } from "express";
import * as paymentMethodsService from "./paymentMethods.service";

// ── GET /me/payment-methods ──────────────────────────────────────────────────

/**
 * Lista los medios de pago del cliente autenticado.
 * clientId → req.auth.sub (garantizado por requireAuth).
 */
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = req.auth!.sub;
    const methods = await paymentMethodsService.listByClient(clientId);
    res.status(200).json(methods);
  } catch (err) {
    next(err);
  }
}

// ── POST /me/payment-methods ─────────────────────────────────────────────────

/**
 * Crea un nuevo medio de pago con status "pending".
 * clientId → req.auth.sub; NO se acepta clientId en el body.
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = req.auth!.sub;
    const method = await paymentMethodsService.create(clientId, req.body);
    res.status(201).json(method);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /payment-methods/:id ──────────────────────────────────────────────

/**
 * Elimina un medio de pago propio.
 * 204 si eliminado · 404 si no existe · 403 si no es del cliente.
 */
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const clientId = req.auth!.sub;
    await paymentMethodsService.remove(id, clientId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ── POST /payment-methods/:id/verify ────────────────────────────────────────

/**
 * Verifica o rechaza un medio de pago (ADMIN).
 * En dev (NODE_ENV !== 'production') también se permite sin rol ADMIN
 * para que el postor pueda auto-verificar sus medios y completar el circuito.
 */
export async function verify(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await paymentMethodsService.verify(id, req.body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}
