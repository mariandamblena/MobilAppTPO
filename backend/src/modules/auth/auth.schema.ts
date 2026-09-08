/**
 * Schemas zod de validación del módulo auth.
 */

import { z } from "zod";

/**
 * Schema de registro (etapa 1).
 * Los campos de archivo (idCardFront, idCardBack, photo) los maneja multer;
 * aquí validamos los campos de texto del formulario multipart.
 */
export const registerSchema = z.object({
  body: z.object({
    document: z
      .string({ required_error: "El DNI es obligatorio" })
      .min(1, "El DNI no puede estar vacío"),
    firstName: z
      .string({ required_error: "El nombre es obligatorio" })
      .min(1, "El nombre no puede estar vacío"),
    lastName: z
      .string({ required_error: "El apellido es obligatorio" })
      .min(1, "El apellido no puede estar vacío"),
    email: z
      .string({ required_error: "El email es obligatorio" })
      .email("El email no tiene un formato válido"),
    address: z
      .string({ required_error: "El domicilio es obligatorio" })
      .min(1, "El domicilio no puede estar vacío"),
    countryId: z
      .string({ required_error: "El país es obligatorio" })
      .regex(/^\d+$/, "countryId debe ser un número entero")
      .transform(Number),
  }),
});

/**
 * Schema de activación (etapa 2).
 * Body: { token, password }
 */
export const activateSchema = z.object({
  body: z.object({
    token: z
      .string({ required_error: "El token de activación es obligatorio" })
      .min(1, "El token no puede estar vacío"),
    password: z
      .string({ required_error: "La contraseña es obligatoria" })
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
  }),
});

/**
 * Schema de login.
 * Body: { email, password }
 */
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "El email es obligatorio" })
      .email("El email no tiene un formato válido"),
    password: z
      .string({ required_error: "La contraseña es obligatoria" })
      .min(1, "La contraseña no puede estar vacía"),
  }),
});
