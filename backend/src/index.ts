import { config } from "./config.js";
import { buildBackend } from "./app.js";

const { server } = buildBackend();

server.listen(config.port, () => {
  console.log(
    `[boot] messaging backend listening on http://localhost:${config.port} (cors: ${config.corsOrigin})`,
  );
});

server.on("error", (err) => {
  console.error("[server-error]", err.message);
  process.exit(1);
});

function shutdown(signal: string): void {
  console.log(`[shutdown] received ${signal}, closing...`);
  server.close(() => process.exit(0));
  // Hard exit if close hangs (keep-alive sockets).
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));