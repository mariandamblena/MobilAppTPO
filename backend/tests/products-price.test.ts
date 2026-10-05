import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

// No database connection or .env is used by this suite.
const { product } = vi.hoisted(() => ({
  product: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: { product } }));

import { createProductSchema, updateProductSchema } from "../src/modules/products/products.schema";
import * as service from "../src/modules/products/products.service";
import * as controller from "../src/modules/products/products.controller";

beforeEach(() => {
  vi.resetAllMocks();
  product.findUnique.mockResolvedValue({ id: 50, ownerId: 20 });
  product.create.mockImplementation(async ({ data }) => ({ id: 50, ...data, photos: [] }));
  product.update.mockImplementation(async ({ data }) => ({ id: 50, ...data, photos: [] }));
});

describe("Product estimated starting price validation", () => {
  it.each([0.01, 12.34, 12.3, 1_000_000_000, null, undefined])("accepts an optional ARS estimate %s on create and update", (price) => {
    const body = { fullDescription: "Taza azul", estimatedStartingPrice: price };
    expect(createProductSchema.parse({ body }).body.estimatedStartingPrice).toBe(price);
    expect(updateProductSchema.parse({ body, params: { id: "50" } }).body.estimatedStartingPrice).toBe(price);
  });

  it.each([0, -1, 1_000_000_000.01, 100.123, NaN, Infinity, -Infinity, "2500", "", true])("rejects invalid money value %s on create and update", (price) => {
    const body = { fullDescription: "Taza azul", estimatedStartingPrice: price };
    expect(createProductSchema.safeParse({ body }).success).toBe(false);
    expect(updateProductSchema.safeParse({ body, params: { id: "50" } }).success).toBe(false);
  });
});

describe("Product estimated starting price persistence", () => {
  it("passes the user's reviewed estimate through the create controller and stores only a product estimate", async () => {
    const req = { owner: { id: 20 }, body: { fullDescription: "Taza azul", estimatedStartingPrice: 6200.5 } } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();
    await controller.createProduct(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(product.create).toHaveBeenCalledWith({
      data: {
        ownerId: 20, fullDescription: "Taza azul", catalogDescription: null, date: null,
        pieceCount: 1, estimatedStartingPrice: 6200.5, artist: null, historicalDate: null,
        history: null, available: false,
      },
      include: { photos: true },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estimatedStartingPrice: 6200.5 }));
  });

  it("keeps manual article creation without an estimate available", async () => {
    await service.createProduct({ ownerId: 20, fullDescription: "Taza azul" });
    expect(product.create.mock.calls[0][0].data.estimatedStartingPrice).toBeNull();
  });

  it("preserves an existing estimate when updating other fields", async () => {
    await service.updateProduct(50, 20, false, { fullDescription: "Descripción revisada" });
    expect(product.update).toHaveBeenCalledWith({
      where: { id: 50 }, data: { fullDescription: "Descripción revisada" }, include: { photos: true },
    });
  });

  it.each([7200.25, null])("allows the owner to replace or remove an estimate: %s", async (price) => {
    await service.updateProduct(50, 20, false, { estimatedStartingPrice: price });
    expect(product.update).toHaveBeenCalledWith({
      where: { id: 50 }, data: { estimatedStartingPrice: price }, include: { photos: true },
    });
  });

  it("does not allow a different owner to change the estimate", async () => {
    await expect(service.updateProduct(50, 21, false, { estimatedStartingPrice: 1 })).rejects.toMatchObject({ httpStatus: 403 });
    expect(product.update).not.toHaveBeenCalled();
  });
});
