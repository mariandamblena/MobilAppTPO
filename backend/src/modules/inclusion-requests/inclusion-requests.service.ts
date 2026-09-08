/**
 * Servicio de solicitudes de inclusión (F06).
 */

import { prisma } from "../../lib/prisma";
import { AppError, ErrorCode, notFound, forbidden, validationError } from "../../lib/errors";
import { createNotification } from "../notifications/notifications.service";

function declarationRequired(): AppError {
  return new AppError(
    ErrorCode.DECLARATION_REQUIRED,
    400,
    "Debés declarar ser el legítimo propietario del bien y que tiene origen lícito"
  );
}

function missingPhotos(): AppError {
  return new AppError(
    ErrorCode.MISSING_PHOTOS,
    400,
    "El producto debe tener al menos 6 fotos para enviar la solicitud de inclusión"
  );
}

export interface CreateInclusionRequestInput {
  ownerId: number;
  productId: number;
  itemDescription: string;
  ownershipDeclared: boolean;
  legalityDeclared: boolean;
}

export async function createInclusionRequest(input: CreateInclusionRequestInput) {
  // 1. Validar declaraciones
  if (!input.ownershipDeclared || !input.legalityDeclared) {
    throw declarationRequired();
  }

  // 2. Validar que el producto exista y sea del dueño
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: { photos: { select: { id: true } } },
  });

  if (!product) throw notFound("Producto");
  if (product.ownerId !== input.ownerId) throw forbidden("No sos el dueño de este producto");

  // 3. Validar ≥6 fotos
  if (product.photos.length < 6) throw missingPhotos();

  return prisma.inclusionRequest.create({
    data: {
      ownerId: input.ownerId,
      productId: input.productId,
      itemDescription: input.itemDescription,
      ownershipDeclared: true,
      legalityDeclared: true,
      status: "pending",
    },
  });
}

export async function listInclusionRequests(filters: {
  ownerId: number;
  status?: string;
}) {
  return prisma.inclusionRequest.findMany({
    where: {
      ownerId: filters.ownerId,
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      product: { include: { photos: { take: 1 } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInclusionRequest(
  id: number,
  requesterId: number,
  isAdmin: boolean
) {
  const request = await prisma.inclusionRequest.findUnique({
    where: { id },
    include: { product: { include: { photos: true } } },
  });

  if (!request) throw notFound("Solicitud de inclusión");
  if (!isAdmin && request.ownerId !== requesterId) throw forbidden("No tenés acceso a esta solicitud");

  return request;
}

export interface InspectionInput {
  result: "accepted" | "rejected";
  rejectionReason?: string;
  returnShippingCost?: number;
  basePrice?: number;
  commission?: number;
  proposedAuctionId?: number;
}

export async function adminInspect(
  id: number,
  input: InspectionInput,
  adminClientId: number
) {
  const request = await prisma.inclusionRequest.findUnique({ where: { id } });
  if (!request) throw notFound("Solicitud de inclusión");

  if (input.result === "rejected") {
    const updated = await prisma.inclusionRequest.update({
      where: { id },
      data: {
        status: "rejected",
        rejectionReason: input.rejectionReason,
        returnShippingCost: input.returnShippingCost,
      },
    });

    // Emitir notificación item_rejected al dueño (F09)
    await emitOwnerNotification(request.ownerId, "item_rejected", {
      title: "Tu bien fue rechazado",
      message: `Tu solicitud fue rechazada. Motivo: ${input.rejectionReason}. Costo de devolución: $${input.returnShippingCost}.`,
      payload: { inclusionRequestId: id, returnShippingCost: input.returnShippingCost },
    });

    return updated;
  }

  // accepted → proposal_sent
  const updated = await prisma.inclusionRequest.update({
    where: { id },
    data: {
      status: "proposal_sent",
      proposedBasePrice: input.basePrice,
      proposedCommission: input.commission,
      proposedAuctionId: input.proposedAuctionId ?? null,
    },
  });

  await emitOwnerNotification(request.ownerId, "inclusion_proposal", {
    title: "Tenés una propuesta de subasta",
    message: `Tu bien fue aceptado. Precio base propuesto: $${input.basePrice}. Comisión: $${input.commission}.`,
    payload: { inclusionRequestId: id, basePrice: input.basePrice, commission: input.commission },
  });

  return updated;
}

export async function ownerResponse(
  id: number,
  ownerId: number,
  accepted: boolean
) {
  const request = await prisma.inclusionRequest.findUnique({ where: { id } });
  if (!request) throw notFound("Solicitud de inclusión");
  if (request.ownerId !== ownerId) throw forbidden("No tenés acceso a esta solicitud");

  if (request.status !== "proposal_sent") {
    throw validationError("Solo podés responder cuando el estado es 'proposal_sent'", {
      status: "La solicitud no tiene una propuesta pendiente de respuesta",
    });
  }

  if (accepted) {
    const [updated] = await prisma.$transaction([
      prisma.inclusionRequest.update({
        where: { id },
        data: { status: "accepted" },
      }),
      // Marcar el producto como disponible para ser incluido en catálogo
      prisma.product.update({
        where: { id: request.productId },
        data: { available: true },
      }),
    ]);
    return updated;
  }

  return prisma.inclusionRequest.update({
    where: { id },
    data: { status: "proposal_rejected" },
  });
}

// ── Utilidad interna ──────────────────────────────────────────────────────────

async function emitOwnerNotification(
  ownerId: number,
  type: string,
  data: { title: string; message: string; payload?: Record<string, unknown> }
) {
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    select: { document: true },
  });
  if (!owner) return;

  const client = await prisma.client.findUnique({
    where: { document: owner.document },
    select: { id: true },
  });
  if (!client) return;

  await createNotification(client.id, type, data.title, data.message, data.payload);
}
