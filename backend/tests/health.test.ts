/**
 * Tests del health check.
 * Verifica que GET /health y GET /v1/health devuelvan el formato correcto.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";

// Configurar el entorno de test antes de importar app
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_SECRET = "test-secret-key-mínimo-16-chars";
process.env.JWT_EXPIRES_IN = "1h";
process.env.UPLOAD_DIR = "uploads-test";
process.env.CORS_ORIGIN = "*";

describe("GET /health", () => {
  it("retorna 200 con status ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
    });
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("el timestamp es una fecha ISO válida", async () => {
    const res = await request(app).get("/health");
    const date = new Date(res.body.timestamp);
    expect(date.getTime()).not.toBeNaN();
  });
});

describe("GET /v1/health", () => {
  it("retorna 200 con status ok bajo el prefijo v1", async () => {
    const res = await request(app).get("/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("404 handler", () => {
  it("retorna 404 para rutas inexistentes", async () => {
    const res = await request(app).get("/ruta-que-no-existe");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
    expect(typeof res.body.message).toBe("string");
  });
});
