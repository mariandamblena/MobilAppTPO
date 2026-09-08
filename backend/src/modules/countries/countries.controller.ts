/**
 * Controlador del módulo countries.
 * GET /countries — público, sin autenticación.
 */

import { Request, Response, NextFunction } from "express";
import * as countriesService from "./countries.service";

/** GET /countries — lista todos los países ordenados por nombre. */
export async function listCountries(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const countries = await countriesService.listCountries();
    res.json(countries);
  } catch (err) {
    next(err);
  }
}
