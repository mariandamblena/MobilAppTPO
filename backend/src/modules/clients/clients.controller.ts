/**
 * Controlador del módulo clients (admin).
 * Traduce requests HTTP → service → response.
 */

import { Request, Response, NextFunction } from "express";
import * as clientsService from "./clients.service";

/** GET /clients — lista clientes con filtros opcionales. Requiere ADMIN. */
export async function listClients(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category, admitted } = req.query as {
      category?: string;
      admitted?: string;
    };

    const filters: clientsService.ListClientsFilters = {};

    if (category !== undefined) {
      filters.category = category;
    }

    if (admitted !== undefined) {
      filters.admitted = admitted === "true";
    }

    const clients = await clientsService.listClients(filters);
    res.json(clients);
  } catch (err) {
    next(err);
  }
}

/** GET /clients/:id — detalle de cliente con país y métodos de pago. Requiere ADMIN o self. */
export async function getClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId = parseInt(req.params.id, 10);
    const client = await clientsService.getClientDetail(clientId);
    res.json(client);
  } catch (err) {
    next(err);
  }
}
