/**
 * Rutas del módulo clients (admin).
 * Base path: /v1/clients (montado en routes/index.ts)
 *
 * GET  /clients       — listar clientes (solo ADMIN, filtros: category, admitted)
 * GET  /clients/:id   — detalle de cliente (ADMIN o self)
 * PATCH /clients/:id  — admitir cliente + asignar categoría + generar ActivationToken
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, requireSelfOrAdmin } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, validationError } from "../../lib/errors";
import { createActivationToken } from "../auth/auth.service";
import { createNotification } from "../notifications/notifications.service";
import { env } from "../../config/env";
import * as clientsController from "./clients.controller";

const router = Router();

const CATEGORIES = ["common", "special", "silver", "gold", "platinum"] as const;

const admitClientSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID debe ser un número").transform(Number),
  }),
  body: z.object({
    admitted: z.boolean().optional(),
    category: z.enum(CATEGORIES).optional(),
    blocked: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
});

const listClientsSchema = z.object({
  query: z.object({
    category: z.enum(CATEGORIES).optional(),
    admitted: z
      .enum(["true", "false"])
      .optional(),
  }),
});

const idParam = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID debe ser un número").transform(Number),
  }),
});

/**
 * GET /clients
 * Lista clientes. Filtros opcionales: category, admitted.
 * Solo ADMIN.
 */
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validate(listClientsSchema),
  clientsController.listClients
);

/**
 * GET /clients/:id
 * Detalle de cliente (incluye country + paymentMethods).
 * ADMIN o el propio cliente.
 */
router.get(
  "/:id",
  requireAuth,
  requireSelfOrAdmin("id"),
  validate(idParam),
  clientsController.getClient
);

/**
 * PATCH /clients/:id
 * Uso principal: admitir cliente y asignar categoría.
 * Solo ADMIN.
 *
 * Al admitir (admitted=true), genera un ActivationToken y envía notificación.
 * En desarrollo, el token se devuelve en la respuesta para facilitar las pruebas.
 * En producción se enviaría por email (TODO: integrar servicio de mail).
 *
 * @example
 *   PATCH /v1/clients/5
 *   { "admitted": true, "category": "silver" }
 *   → 200 { client, activationToken: "act_..." }  // token devuelto solo en dev
 */
router.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate(admitClientSchema),
  async (req, res, next) => {
    try {
      const clientId = req.params.id as unknown as number;
      const { admitted, category, blocked, active } = req.body;

      const existing = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!existing) {
        return next(notFound("Cliente"));
      }

      // Validar: si se admite, la categoría es obligatoria
      if (admitted === true && !category && !existing.category) {
        return next(
          validationError("Al admitir se debe asignar una categoría", {
            category: "Requerida al admitir",
          })
        );
      }

      const updatedClient = await prisma.client.update({
        where: { id: clientId },
        data: {
          ...(admitted !== undefined && { admitted }),
          ...(category !== undefined && { category }),
          ...(blocked !== undefined && { blocked }),
          ...(active !== undefined && { active }),
        },
      });

      // Generar ActivationToken si se acaba de admitir
      let activationToken: string | undefined;

      const wasJustAdmitted = admitted === true && !existing.admitted;

      if (wasJustAdmitted) {
        activationToken = await createActivationToken(clientId);

        // Notificar al cliente sobre su admisión
        await createNotification(
          clientId,
          "admission",
          "Cuenta admitida",
          "Tu cuenta fue admitida. Ya podés activarla y participar.",
          {}
        );
      }

      const response: Record<string, unknown> = {
        client: {
          id: updatedClient.id,
          document: updatedClient.document,
          firstName: updatedClient.firstName,
          lastName: updatedClient.lastName,
          email: updatedClient.email,
          admitted: updatedClient.admitted,
          category: updatedClient.category,
          blocked: updatedClient.blocked,
          active: updatedClient.active,
        },
      };

      // En desarrollo, devolver el token en la respuesta para pruebas
      // En producción se enviaría por email y NO se incluiría aquí
      if (activationToken && env.NODE_ENV !== "production") {
        response.activationToken = activationToken;
        response._dev_note =
          "activationToken solo visible en development/test. En producción se envía por mail.";
      }

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
