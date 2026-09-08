/**
 * Controlador del módulo auth.
 * Traduce requests HTTP → service → response.
 * Sin lógica de negocio aquí — solo orquestación.
 */

import { Request, Response, NextFunction } from "express";
import path from "path";
import * as authService from "./auth.service";

/**
 * POST /auth/register (multipart/form-data)
 * Crea el cliente en estado admitted=false.
 * Los archivos (idCardFront, idCardBack, photo) los maneja multer.
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    // Construir URLs locales para los archivos subidos
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    function fileUrl(field: string): string | undefined {
      const file = files?.[field]?.[0];
      if (!file) return undefined;
      // Normalizar separadores de ruta para URL
      const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
      return `${baseUrl}/${relativePath}`;
    }

    const client = await authService.register({
      document: req.body.document,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      address: req.body.address,
      countryId: Number(req.body.countryId),
      idCardFrontUrl: fileUrl("idCardFront"),
      idCardBackUrl: fileUrl("idCardBack"),
      photoUrl: fileUrl("photo"),
    });

    res.status(201).json({
      client,
      nextStep: "await_admission_email",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/activate
 * Setea password, marca token usado, devuelve JWT.
 */
export async function activate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.activate({
      token: req.body.token,
      password: req.body.password,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/login
 * Verifica credenciales y devuelve JWT.
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/me
 * Devuelve el cliente actual desde el JWT.
 * Requiere requireAuth middleware.
 */
export async function me(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // req.auth es garantizado por requireAuth
    const user = await authService.me(req.auth!.sub);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}
