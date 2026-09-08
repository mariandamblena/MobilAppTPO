/**
 * Servicio del módulo products.
 */

import { prisma } from "../../lib/prisma";
import { notFound, forbidden } from "../../lib/errors";

export interface CreateProductInput {
  ownerId: number;
  fullDescription: string;
  catalogDescription?: string;
  date?: string;
  pieceCount?: number;
  artist?: string;
  historicalDate?: string;
  history?: string;
}

/** Crea un producto en estado draft (available: false). */
export async function createProduct(input: CreateProductInput) {
  return prisma.product.create({
    data: {
      ownerId: input.ownerId,
      fullDescription: input.fullDescription,
      catalogDescription: input.catalogDescription ?? null,
      date: input.date ? new Date(input.date) : null,
      pieceCount: input.pieceCount ?? 1,
      artist: input.artist ?? null,
      historicalDate: input.historicalDate ?? null,
      history: input.history ?? null,
      available: false,
    },
    include: { photos: true },
  });
}

/** Agrega una foto a un producto. Valida que el producto sea del dueño. */
export async function addPhoto(
  productId: number,
  ownerId: number,
  photoUrl: string
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, ownerId: true },
  });

  if (!product) throw notFound("Producto");
  if (product.ownerId !== ownerId) throw forbidden("No sos el dueño de este producto");

  return prisma.photo.create({
    data: { productId, photoUrl },
  });
}

/** Lista productos. OWNER solo ve los suyos; ADMIN puede ver todos o filtrar por ownerId. */
export async function listProducts(filters: {
  ownerId?: number;
  available?: boolean;
}) {
  return prisma.product.findMany({
    where: {
      ...(filters.ownerId !== undefined ? { ownerId: filters.ownerId } : {}),
      ...(filters.available !== undefined ? { available: filters.available } : {}),
    },
    include: { photos: { take: 1 } },
    orderBy: { id: "desc" },
  });
}

/** Obtiene el detalle de un producto con fotos, location e insurance si aplica. */
export async function getProductDetail(productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      photos: true,
      location: true,
    },
  });

  if (!product) throw notFound("Producto");

  // Cargar insuranceDetail si el producto tiene póliza asignada
  let insuranceDetail: object | null = null;
  if (product.insurancePolicy) {
    insuranceDetail = await prisma.insurance.findUnique({
      where: { policyNumber: product.insurancePolicy },
    });
  }

  return { ...product, insuranceDetail };
}

export interface UpdateProductInput {
  date?: string;
  available?: boolean;
  catalogDescription?: string;
  fullDescription?: string;
  reviewerId?: number;
  insurancePolicy?: string;
  pieceCount?: number;
  artist?: string;
  historicalDate?: string;
  history?: string;
}

/** Actualiza un producto. Valida que sea del dueño (o admin). */
export async function updateProduct(
  productId: number,
  callerId: number,
  isAdmin: boolean,
  input: UpdateProductInput
) {
  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, ownerId: true },
  });

  if (!existing) throw notFound("Producto");
  if (!isAdmin && existing.ownerId !== callerId) {
    throw forbidden("No sos el dueño de este producto");
  }

  return prisma.product.update({
    where: { id: productId },
    data: {
      ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
      ...(input.available !== undefined ? { available: input.available } : {}),
      ...(input.catalogDescription !== undefined ? { catalogDescription: input.catalogDescription } : {}),
      ...(input.fullDescription !== undefined ? { fullDescription: input.fullDescription } : {}),
      ...(input.reviewerId !== undefined ? { reviewerId: input.reviewerId } : {}),
      ...(input.insurancePolicy !== undefined ? { insurancePolicy: input.insurancePolicy } : {}),
      ...(input.pieceCount !== undefined ? { pieceCount: input.pieceCount } : {}),
      ...(input.artist !== undefined ? { artist: input.artist } : {}),
      ...(input.historicalDate !== undefined ? { historicalDate: input.historicalDate } : {}),
      ...(input.history !== undefined ? { history: input.history } : {}),
    },
    include: { photos: true },
  });
}

