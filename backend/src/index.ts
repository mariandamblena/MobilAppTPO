/**
 * Entry point del servidor HTTP.
 * Carga variables de entorno, arranca Express en el puerto configurado.
 */

// Importar env primero para que dotenv configure process.env antes de todo
import "./config/env";
import app from "./app";
import { env } from "./config/env";

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  console.log(`\nAuctify Backend`);
  console.log(`   Entorno : ${env.NODE_ENV}`);
  console.log(`   Puerto  : ${PORT}`);
  console.log(`   Base URL: http://localhost:${PORT}/v1`);
  console.log(`   Health  : http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM recibido. Cerrando servidor...");
  server.close(() => {
    console.log("Servidor cerrado.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\nSIGINT recibido. Cerrando servidor...");
  server.close(() => {
    process.exit(0);
  });
});
