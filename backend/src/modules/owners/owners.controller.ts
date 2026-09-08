/**
 * Controlador del módulo owners.
 * Traduce requests HTTP → service → response.
 */

import { Request, Response, NextFunction } from "express";
import * as ownersService from "./owners.service";

/** GET /owners — lista todos los owners. Solo ADMIN. */
export async function listOwners(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owners = await ownersService.listOwners();
    res.json(owners);
  } catch (err) {
    next(err);
  }
}

/** POST /owners — crea un owner. Solo ADMIN. */
export async function createOwner(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = await ownersService.createOwner({
      document: req.body.document,
      name: req.body.name,
      address: req.body.address,
      countryId: req.body.countryId,
      financialVerification: req.body.financialVerification,
      judicialVerification: req.body.judicialVerification,
      riskRating: req.body.riskRating,
      verifierId: req.body.verifierId,
    });
    res.status(201).json(owner);
  } catch (err) {
    next(err);
  }
}

/** GET /owners/:id — detalle de owner. */
export async function getOwner(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = parseInt(req.params.id, 10);
    const owner = await ownersService.getOwner(ownerId);
    res.json(owner);
  } catch (err) {
    next(err);
  }
}
