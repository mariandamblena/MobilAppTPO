import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database module before importing the service: no .env, PrismaClient,
// shared test.db or development data is read or changed by these tests.
const { database, transaction } = vi.hoisted(() => {
  const transaction = {
    product: { updateMany: vi.fn(), findUnique: vi.fn() },
    inclusionRequest: { findFirst: vi.fn(), create: vi.fn() },
  };
  return { transaction, database: { $transaction: vi.fn() } };
});
vi.mock("../src/lib/prisma", () => ({ prisma: database }));
vi.mock("../src/modules/notifications/notifications.service", () => ({ createNotification: vi.fn() }));

import { createInclusionRequest } from "../src/modules/inclusion-requests/inclusion-requests.service";

const input = {
  productId: 11,
  ownerId: 2,
  itemDescription: "Juego de tazas",
  ownershipDeclared: true,
  legalityDeclared: true,
};
const product = { id: 11, ownerId: 2, photos: Array.from({ length: 6 }, (_, id) => ({ id: id + 1 })) };
type StoredRequest = typeof input & { id: number; status: string; createdAt: Date };
let stored: StoredRequest[];

function record(status: string, id = 20): StoredRequest {
  return { ...input, id, status, createdAt: new Date("2026-10-05T00:00:00Z") };
}

beforeEach(() => {
  vi.clearAllMocks();
  stored = [];
  database.$transaction.mockImplementation(async (callback) => callback(transaction));
  transaction.product.updateMany.mockResolvedValue({ count: 1 });
  transaction.product.findUnique.mockResolvedValue(product);
  transaction.inclusionRequest.findFirst.mockImplementation(async ({ where }) =>
    stored.filter((request) => request.productId === where.productId && request.ownerId === where.ownerId && where.status.in.includes(request.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)[0] ?? null);
  transaction.inclusionRequest.create.mockImplementation(async ({ data }) => {
    // Yield before inserting so an unprotected check/create race creates duplicates.
    await Promise.resolve();
    const created = { ...data, id: stored.length + 100, createdAt: new Date() };
    stored.push(created);
    return created;
  });
});

describe("inclusion request retry and concurrency", () => {
  it("returns the original request on retry without replacing its description", async () => {
    const first = await createInclusionRequest(input);
    const retry = await createInclusionRequest({ ...input, itemDescription: "Descripción del reintento" });
    expect(retry).toEqual(first);
    expect(retry.itemDescription).toBe("Juego de tazas");
    expect(stored).toHaveLength(1);
    expect(transaction.inclusionRequest.create).toHaveBeenCalledOnce();
  });

  it.each(["pending", "under_inspection", "proposal_sent", "accepted"])("reuses a request in %s state", async (status) => {
    stored.push(record(status));
    const retry = await createInclusionRequest(input);
    expect(retry.id).toBe(20);
    expect(retry.status).toBe(status);
    expect(transaction.inclusionRequest.create).not.toHaveBeenCalled();
  });

  it.each(["rejected", "proposal_rejected"])("allows resubmission after %s without deleting history", async (status) => {
    stored.push(record(status));
    const created = await createInclusionRequest(input);
    expect(created.id).not.toBe(20);
    expect(created.status).toBe("pending");
    expect(stored).toHaveLength(2);
    expect(stored[0].status).toBe(status);
  });

  it("returns the same request for concurrent submissions", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => createInclusionRequest(input)));
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(stored).toHaveLength(1);
    expect(transaction.inclusionRequest.create).toHaveBeenCalledOnce();
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable", maxWait: 10_000, timeout: 10_000,
    });
  });

  it("takes the SQLite write lock before reading the product or active requests", async () => {
    await createInclusionRequest(input);
    expect(transaction.product.updateMany).toHaveBeenCalledWith({
      where: { id: input.productId, ownerId: input.ownerId }, data: { id: input.productId },
    });
    expect(transaction.product.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(transaction.product.findUnique.mock.invocationCallOrder[0]);
    expect(transaction.product.findUnique.mock.invocationCallOrder[0])
      .toBeLessThan(transaction.inclusionRequest.findFirst.mock.invocationCallOrder[0]);
  });

  it("preserves existing duplicate requests and deterministically returns the latest active one", async () => {
    stored.push(record("pending", 20), record("pending", 21), record("rejected", 22));
    const retry = await createInclusionRequest(input);
    expect(retry.id).toBe(21);
    expect(stored).toHaveLength(3);
    expect(transaction.inclusionRequest.create).not.toHaveBeenCalled();
  });

  it("does not reuse another product or owner's request", async () => {
    stored.push({ ...record("pending"), productId: 12 }, { ...record("accepted", 21), ownerId: 3 });
    const created = await createInclusionRequest(input);
    expect(created.id).not.toBe(20);
    expect(created.id).not.toBe(21);
    expect(stored).toHaveLength(3);
  });

  it("releases the queue after a failed transaction so retry can succeed", async () => {
    database.$transaction.mockRejectedValueOnce(new Error("database temporarily unavailable"));
    await expect(createInclusionRequest(input)).rejects.toThrow("database temporarily unavailable");
    await expect(createInclusionRequest(input)).resolves.toMatchObject({ status: "pending" });
    expect(stored).toHaveLength(1);
  });
});

describe("inclusion request validation still applies on retry", () => {
  it.each([
    { ownershipDeclared: false, legalityDeclared: true },
    { ownershipDeclared: true, legalityDeclared: false },
  ])("requires both declarations before any database operation", async (declarations) => {
    stored.push(record("pending"));
    await expect(createInclusionRequest({ ...input, ...declarations }))
      .rejects.toMatchObject({ code: "DECLARATION_REQUIRED", httpStatus: 400 });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a different owner even if an active request exists", async () => {
    stored.push(record("pending"));
    await expect(createInclusionRequest({ ...input, ownerId: 9 }))
      .rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
    expect(transaction.inclusionRequest.findFirst).not.toHaveBeenCalled();
    expect(transaction.inclusionRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a missing product", async () => {
    transaction.product.findUnique.mockResolvedValue(null);
    await expect(createInclusionRequest(input))
      .rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND", httpStatus: 404 });
    expect(transaction.inclusionRequest.create).not.toHaveBeenCalled();
  });

  it("requires six photos even when retrying a previous submission", async () => {
    stored.push(record("pending"));
    transaction.product.findUnique.mockResolvedValue({ ...product, photos: product.photos.slice(0, 5) });
    await expect(createInclusionRequest(input))
      .rejects.toMatchObject({ code: "MISSING_PHOTOS", httpStatus: 400 });
    expect(transaction.inclusionRequest.findFirst).not.toHaveBeenCalled();
    expect(transaction.inclusionRequest.create).not.toHaveBeenCalled();
  });
});
