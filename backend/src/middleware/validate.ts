/**
 * Middleware de validación con zod.
 * Valida body, query y params contra el schema provisto.
 * En caso de error emite AppError VALIDATION_ERROR con details.fields.
 *
 */

import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { AppError, ErrorCode } from "../lib/errors";

/**
 * Crea un middleware Express que valida req con el schema zod provisto.
 * Combina body + query + params en un objeto único para el schema.
 *
 * @example
 *   router.post("/login", validate(loginSchema), authController.login);
 */
export function validate(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Reemplaza los campos validados (parsea y strip unknown)
      const result = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      req.body = result.body ?? req.body;
      req.query = result.query ?? req.query;
      // params es readonly en Express pero podemos asignar las propiedades
      Object.assign(req.params, result.params ?? {});

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) {
          // Quita el prefijo "body." / "query." / "params." para el cliente
          const rawPath = issue.path.join(".");
          const key = rawPath.replace(/^(body|query|params)\.?/, "") || "body";
          fields[key] = issue.message;
        }
        return next(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            400,
            "Datos de entrada inválidos",
            { fields }
          )
        );
      }
      next(err);
    }
  };
}
