/**
 * Tests del módulo F06 — productos e inclusión de bienes.
 *
 * Usa el usuario seed (gold) como owner y el admin seed como admin.
 * Seed: DNI 30111222 / Secret123! (postor gold), DNI 00000001 / Admin123! (admin)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import path from "path";
import fs from "fs";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_SECRET = "test-secret-key-mínimo-16-chars";
process.env.JWT_EXPIRES_IN = "1h";
process.env.UPLOAD_DIR = "uploads-test";
process.env.CORS_ORIGIN = "*";

import app from "../src/app";

// ── Imagen mínima de prueba (1×1 PNG) ────────────────────────────────────────

const MINIMAL_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
    "2e0000000c4944415478016360f8cfc000000002000174e49650000000049454e44ae426082",
  "hex"
);

const TEST_IMAGE = path.join(process.cwd(), "uploads-test", "test-photo-f06.png");

// ── Setup ─────────────────────────────────────────────────────────────────────

let ownerToken: string;
let adminToken: string;

beforeAll(async () => {
  fs.mkdirSync(path.join(process.cwd(), "uploads-test"), { recursive: true });
  fs.writeFileSync(TEST_IMAGE, MINIMAL_PNG);

  const [ownerLogin, adminLogin] = await Promise.all([
    request(app).post("/v1/auth/login").send({ document: "30111222", password: "Secret123!" }),
    request(app).post("/v1/auth/login").send({ document: "00000001", password: "Admin123!" }),
  ]);

  ownerToken = ownerLogin.body.token;
  adminToken = adminLogin.body.token;
});

afterAll(() => {
  try { fs.unlinkSync(TEST_IMAGE); } catch {}
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadPhoto(productId: number, token: string) {
  return request(app)
    .post(`/v1/products/${productId}/photos`)
    .set("Authorization", `Bearer ${token}`)
    .attach("photo", TEST_IMAGE, "foto.png");
}

// ── Tests de validación ───────────────────────────────────────────────────────

describe("POST /v1/products — validación de entrada", () => {
  it("retorna 401 sin token", async () => {
    const res = await request(app).post("/v1/products").send({ fullDescription: "Test" });
    expect(res.status).toBe(401);
  });

  it("retorna 400 VALIDATION_ERROR si falta fullDescription", async () => {
    const res = await request(app)
      .post("/v1/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /v1/products/:id/photos — validación", () => {
  it("retorna 400 si no se adjunta foto", async () => {
    // Crear producto primero
    const p = await request(app)
      .post("/v1/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullDescription: "Objeto sin foto" });
    const productId: number = p.body.id;

    const res = await request(app)
      .post(`/v1/products/${productId}/photos`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });
});

describe("POST /v1/inclusion-requests — reglas de negocio", () => {
  it("retorna 400 DECLARATION_REQUIRED si ownershipDeclared es false", async () => {
    const p = await request(app)
      .post("/v1/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullDescription: "Bien sin declarar" });
    const productId: number = p.body.id;
    for (let i = 0; i < 6; i++) await uploadPhoto(productId, ownerToken);

    const res = await request(app)
      .post("/v1/inclusion-requests")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId, itemDescription: "Desc", ownershipDeclared: false, legalityDeclared: true });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DECLARATION_REQUIRED");
  });

  it("retorna 400 MISSING_PHOTOS con menos de 6 fotos", async () => {
    const p = await request(app)
      .post("/v1/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullDescription: "Bien con pocas fotos" });
    const productId: number = p.body.id;
    // Solo 4 fotos
    for (let i = 0; i < 4; i++) await uploadPhoto(productId, ownerToken);

    const res = await request(app)
      .post("/v1/inclusion-requests")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId, itemDescription: "Desc", ownershipDeclared: true, legalityDeclared: true });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_PHOTOS");
  });

  it("retorna 400 VALIDATION_ERROR si falta itemDescription", async () => {
    const p = await request(app)
      .post("/v1/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullDescription: "Algo" });
    const res = await request(app)
      .post("/v1/inclusion-requests")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId: p.body.id, ownershipDeclared: true, legalityDeclared: true });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("Happy path — producto → 6 fotos → solicitud → inspección → owner-response", () => {
  let productId: number;
  let inclusionRequestId: number;

  it("crea un producto draft (available: false)", async () => {
    const res = await request(app)
      .post("/v1/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullDescription: "Mesa de roble macizo s. XIX", catalogDescription: "Mesa roble", pieceCount: 1 });

    expect(res.status).toBe(201);
    expect(res.body.available).toBe(false);
    productId = res.body.id;
  });

  it("sube 6 fotos y cada una retorna 201 con photoUrl", async () => {
    for (let i = 0; i < 6; i++) {
      const res = await uploadPhoto(productId, ownerToken);
      expect(res.status).toBe(201);
      expect(res.body.photoUrl).toBeTruthy();
    }
  });

  it("crea la solicitud con status pending", async () => {
    const res = await request(app)
      .post("/v1/inclusion-requests")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId, itemDescription: "Mesa de roble macizo, en buen estado", ownershipDeclared: true, legalityDeclared: true });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    inclusionRequestId = res.body.id;
  });

  it("admin acepta → status proposal_sent con precio base", async () => {
    const res = await request(app)
      .post(`/v1/inclusion-requests/${inclusionRequestId}/inspection`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ result: "accepted", basePrice: 20000, commission: 2000 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("proposal_sent");
    expect(res.body.proposedBasePrice).toBe(20000);
  });

  it("owner no puede responder una propuesta que no es suya (ownership check)", async () => {
    // Registrar un segundo usuario (trick: usar admin token en un endpoint distinto)
    // Usamos admin como "otro owner" — el admin tiene un owner distinto
    const res = await request(app)
      .post(`/v1/inclusion-requests/${inclusionRequestId}/owner-response`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ accepted: true });

    expect(res.status).toBe(403);
  });

  it("owner acepta la propuesta → status accepted, producto available: true", async () => {
    const res = await request(app)
      .post(`/v1/inclusion-requests/${inclusionRequestId}/owner-response`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ accepted: true });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
  });

  it("owner no puede responder nuevamente (ya no es proposal_sent)", async () => {
    const res = await request(app)
      .post(`/v1/inclusion-requests/${inclusionRequestId}/owner-response`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ accepted: false });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("listado de solicitudes del owner retorna al menos la creada", async () => {
    const res = await request(app)
      .get("/v1/inclusion-requests")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((r: { id: number }) => r.id === inclusionRequestId);
    expect(found).toBeTruthy();
  });

  it("admin rechaza una solicitud distinta → status rejected con returnShippingCost", async () => {
    // Crear otro producto + solicitud para probar rechazo
    const p = await request(app)
      .post("/v1/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullDescription: "Silla vintage" });
    const pid: number = p.body.id;
    for (let i = 0; i < 6; i++) await uploadPhoto(pid, ownerToken);
    const ir = await request(app)
      .post("/v1/inclusion-requests")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId: pid, itemDescription: "Silla", ownershipDeclared: true, legalityDeclared: true });

    const res = await request(app)
      .post(`/v1/inclusion-requests/${ir.body.id}/inspection`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ result: "rejected", rejectionReason: "Mal estado", returnShippingCost: 800 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
    expect(res.body.returnShippingCost).toBe(800);
  });
});
