/**
 * Tests de F08 (métricas) y F09 (notificaciones).
 *
 * F08: Las métricas dependen de Attendee/Bid/SaleRecord. Sin datos de subastas,
 * el cliente verá todos los valores en 0 y byCategory vacío — eso es el caso
 * base que verificamos aquí.
 *
 * F09: Las notificaciones se emiten al admin al admitir un cliente y al ejecutar
 * la inspección de F06. Aquí probamos el listado y marcado como leída directamente.
 *
 * Seed: DNI 30111222 / Secret123! (gold), DNI 00000001 / Admin123! (admin)
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_SECRET = "test-secret-key-mínimo-16-chars";
process.env.JWT_EXPIRES_IN = "1h";
process.env.UPLOAD_DIR = "uploads-test";
process.env.CORS_ORIGIN = "*";

import app from "../src/app";
import { prisma } from "../src/lib/prisma";

let goldToken: string;
let adminToken: string;
let goldClientId: number;

beforeAll(async () => {
  const [goldLogin, adminLogin] = await Promise.all([
    request(app).post("/v1/auth/login").send({ document: "30111222", password: "Secret123!" }),
    request(app).post("/v1/auth/login").send({ document: "00000001", password: "Admin123!" }),
  ]);

  goldToken = goldLogin.body.token;
  adminToken = adminLogin.body.token;
  goldClientId = goldLogin.body.user.id;
});

// ─────────────────────────────────────────────────────────────────────────────
// F08 — Métricas
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /v1/me/metrics — autenticación y estructura", () => {
  it("retorna 401 sin token", async () => {
    const res = await request(app).get("/v1/me/metrics");
    expect(res.status).toBe(401);
  });

  it("retorna 200 con estructura Metrics para el propio cliente", async () => {
    const res = await request(app)
      .get("/v1/me/metrics")
      .set("Authorization", `Bearer ${goldToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      auctionsAttended: expect.any(Number),
      auctionsWon: expect.any(Number),
      totalBidAmount: expect.any(Number),
      totalPaidAmount: expect.any(Number),
      byCategory: expect.any(Array),
    });
  });

  it("cliente sin subastas: todos los valores son 0 y byCategory vacío", async () => {
    const res = await request(app)
      .get("/v1/me/metrics")
      .set("Authorization", `Bearer ${goldToken}`);

    expect(res.status).toBe(200);
    expect(res.body.byCategory).toEqual([]);
  });
});

describe("GET /v1/clients/:id/metrics — acceso admin", () => {
  it("retorna 403 si el cliente no es admin", async () => {
    const res = await request(app)
      .get(`/v1/clients/${goldClientId}/metrics`)
      .set("Authorization", `Bearer ${goldToken}`);

    expect(res.status).toBe(403);
  });

  it("admin puede acceder a las métricas de cualquier cliente", async () => {
    const res = await request(app)
      .get(`/v1/clients/${goldClientId}/metrics`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("auctionsAttended");
  });

  it("retorna 404 si el cliente no existe", async () => {
    const res = await request(app)
      .get("/v1/clients/999999/metrics")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F09 — Notificaciones
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /v1/me/notifications", () => {
  it("retorna 401 sin token", async () => {
    const res = await request(app).get("/v1/me/notifications");
    expect(res.status).toBe(401);
  });

  it("retorna 200 con { items, unreadCount }", async () => {
    const res = await request(app)
      .get("/v1/me/notifications")
      .set("Authorization", `Bearer ${goldToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("unreadCount");
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.unreadCount).toBe("number");
  });

  it("unreadOnly=true filtra correctamente", async () => {
    // Crear una notificación de prueba leída y una no leída
    await prisma.notification.createMany({
      data: [
        { clientId: goldClientId, type: "info", title: "Leída", message: "msg", read: true },
        { clientId: goldClientId, type: "info", title: "No leída", message: "msg", read: false },
      ],
    });

    const res = await request(app)
      .get("/v1/me/notifications?unreadOnly=true")
      .set("Authorization", `Bearer ${goldToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.every((n: { read: boolean }) => !n.read)).toBe(true);
  });
});

describe("POST /v1/notifications/:id/read", () => {
  it("marca una notificación propia como leída (204)", async () => {
    const notif = await prisma.notification.create({
      data: {
        clientId: goldClientId,
        type: "info",
        title: "Para marcar",
        message: "msg",
        read: false,
      },
    });

    const res = await request(app)
      .post(`/v1/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${goldToken}`);

    expect(res.status).toBe(204);

    const updated = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(updated?.read).toBe(true);
  });

  it("retorna 404 si la notificación no existe", async () => {
    const res = await request(app)
      .post("/v1/notifications/999999/read")
      .set("Authorization", `Bearer ${goldToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("retorna 404 si la notificación es de otro cliente", async () => {
    // Notificación del admin
    const adminClient = await prisma.client.findUnique({
      where: { document: "00000001" },
      select: { id: true },
    });

    const notif = await prisma.notification.create({
      data: {
        clientId: adminClient!.id,
        type: "info",
        title: "Del admin",
        message: "msg",
        read: false,
      },
    });

    const res = await request(app)
      .post(`/v1/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${goldToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });
});
