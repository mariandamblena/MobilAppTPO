import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Ejecutar los tests en secuencia para evitar conflictos de DB en SQLite
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Timeout generoso para tests de integración con DB
    testTimeout: 15_000,
    // Reportes
    reporters: ["verbose"],
  },
});
