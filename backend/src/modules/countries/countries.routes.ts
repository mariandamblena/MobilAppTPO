/**
 * Rutas del módulo countries.
 * Base path: /v1/countries (montado en routes/index.ts)
 *
 * GET /countries — público, sin autenticación — lista todos los países
 */

import { Router } from "express";
import * as countriesController from "./countries.controller";

const router = Router();

/** GET /countries — lista todos los países ordenados por nombre. */
router.get("/", countriesController.listCountries);

export default router;
