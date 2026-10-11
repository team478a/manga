import { createGatewayServer, readGatewayConfig } from "./gateway.mjs";

const config = readGatewayConfig();
if (!config) throw new Error("ClamAV gateway configuration is incomplete.");

const server = createGatewayServer(config);
server.listen(config.port, "0.0.0.0", () => {
  console.log("ClamAV gateway is listening.");
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
