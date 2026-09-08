/**
 * Controlador del módulo penalties.
 * Traduce requests HTTP → service → response.
 * Sin lógica de negocio aquí — solo orquestación.
 *
 */

import { Request, Response, NextFunction } from "express";
import * as penaltiesService from "./penalties.service";

/**
 * POST /penalties
 * Crea una multa y bloquea al cliente.
 * Rol SYSTEM (en dev, accesible sin rol ADMIN para testing).
 * 201 → Penalty creada.
 */
export async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const penalty = await penaltiesService.create({
      clientId: req.body.clientId,
      auctionId: req.body.auctionId,
      itemId: req.body.itemId,
      amount: req.body.amount,
    });

    res.status(201).json(penalty);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /me/penalties
 * Devuelve el historial de multas del cliente autenticado.
 * req.auth.sub es el clientId (identidad del token, ver ADR-003-jwt-identity).
 * 200 → Penalty[].
 */
export async function listMine(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // El clientId viene del JWT; nunca del body ni query
    const clientId = req.auth!.sub;
    const penalties = await penaltiesService.listByClient(clientId);

    res.status(200).json(penalties);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /clients/:id/penalties
 * Devuelve el historial de multas de cualquier cliente (solo ADMIN).
 * 200 → Penalty[].
 */
export async function listByClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId = parseInt(req.params.id, 10);
    const penalties = await penaltiesService.listByClient(clientId);

    res.status(200).json(penalties);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /penalties/:id/pay
 * Paga una multa. Solo el cliente dueño o un admin.
 * 200 → { ...penalty, clientUnblocked: boolean }
 */
export async function pay(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const penaltyId = parseInt(req.params.id, 10);
    const requestingClientId = req.auth!.sub;
    const isAdmin = req.auth!.roles.includes("ADMIN");

    const { penalty, clientUnblocked } = await penaltiesService.pay(
      penaltyId,
      requestingClientId,
      isAdmin
    );

    res.status(200).json({ ...penalty, clientUnblocked });
  } catch (err) {
    next(err);
  }
}
