import net from "node:net";

export function readClamAvConnection(input: { host?: string; port?: number } = {}) {
  const host = input.host ?? process.env.MANGAI_EXTERNAL_CLAMAV_HOST;
  const port = input.port ?? Number(process.env.MANGAI_EXTERNAL_CLAMAV_PORT ?? 3310);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

export async function checkClamAvReadiness(input: {
  host?: string;
  port?: number;
  timeoutMs?: number;
} = {}): Promise<"ready" | "unavailable"> {
  const connection = readClamAvConnection(input);
  if (!connection) return "unavailable";
  const timeoutMs = input.timeoutMs ?? 5_000;

  return new Promise((resolve) => {
    let socket: net.Socket | undefined;
    let response = "";
    let settled = false;
    const finish = (status: "ready" | "unavailable") => {
      if (settled) return;
      settled = true;
      socket?.destroy();
      resolve(status);
    };
    try {
      socket = net.createConnection(connection);
    } catch {
      resolve("unavailable");
      return;
    }
    socket.setTimeout(timeoutMs, () => finish("unavailable"));
    socket.on("error", () => finish("unavailable"));
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (response.length > 1024) return finish("unavailable");
      if (response.includes("\0"))
        finish(response.replace(/\0/g, "").trim() === "PONG" ? "ready" : "unavailable");
    });
    socket.on("close", () => {
      if (!settled)
        finish(response.replace(/\0/g, "").trim() === "PONG" ? "ready" : "unavailable");
    });
    socket.on("connect", () => socket?.write("zPING\0"));
  });
}
