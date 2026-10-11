import net from "node:net";

type ClamAvStatus = "clean" | "infected" | "unavailable";
type ClamAvTransport = "tcp" | "https_gateway";

const GATEWAY_RESPONSE_LIMIT = 4 * 1024;

function selectedTransport(input: {
  transport?: ClamAvTransport;
  host?: string;
  gatewayUrl?: string;
}) {
  if (input.transport) return input.transport;
  if (input.gatewayUrl !== undefined) return "https_gateway";
  if (input.host !== undefined) return "tcp";
  const configured = process.env.MANGAI_EXTERNAL_CLAMAV_TRANSPORT;
  if (configured === "tcp" || configured === "https_gateway") return configured;
  if (configured) return null;
  return process.env.MANGAI_EXTERNAL_CLAMAV_GATEWAY_URL ? "https_gateway" : "tcp";
}

export function readClamAvConnection(input: { host?: string; port?: number } = {}) {
  const host = input.host ?? process.env.MANGAI_EXTERNAL_CLAMAV_HOST;
  const port = input.port ?? Number(process.env.MANGAI_EXTERNAL_CLAMAV_PORT ?? 3310);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

export function readClamAvGatewayConfig(input: {
  url?: string;
  secret?: string;
} = {}) {
  const rawUrl = input.url ?? process.env.MANGAI_EXTERNAL_CLAMAV_GATEWAY_URL;
  const secret = input.secret ?? process.env.MANGAI_EXTERNAL_CLAMAV_GATEWAY_SECRET;
  if (!rawUrl || !secret || secret.length < 32) return null;
  try {
    const url = new URL(rawUrl);
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    return { baseUrl: `${url.origin}/`, secret };
  } catch {
    return null;
  }
}

async function readBoundedJson(response: Response) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > GATEWAY_RESPONSE_LIMIT) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as { status?: unknown };
  } catch {
    return null;
  }
}

async function callGateway(input: {
  path: "v1/readiness" | "v1/scan";
  method: "GET" | "POST";
  body?: Uint8Array;
  url?: string;
  secret?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}) {
  const config = readClamAvGatewayConfig({ url: input.url, secret: input.secret });
  if (!config) return null;
  try {
    const response = await (input.fetchImpl ?? fetch)(new URL(input.path, config.baseUrl), {
      method: input.method,
      headers: {
        authorization: `Bearer ${config.secret}`,
        ...(input.body
          ? {
              "content-type": "application/octet-stream",
              "content-length": String(input.body.byteLength),
            }
          : {}),
      },
      body: input.body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(input.timeoutMs),
    });
    if (!response.ok) return null;
    return readBoundedJson(response);
  } catch {
    return null;
  }
}

async function checkTcpReadiness(input: {
  host?: string;
  port?: number;
  timeoutMs: number;
}): Promise<"ready" | "unavailable"> {
  const connection = readClamAvConnection(input);
  if (!connection) return "unavailable";
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
    socket.setTimeout(input.timeoutMs, () => finish("unavailable"));
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

export async function checkClamAvReadiness(input: {
  transport?: ClamAvTransport;
  host?: string;
  port?: number;
  gatewayUrl?: string;
  gatewaySecret?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
} = {}): Promise<"ready" | "unavailable"> {
  const timeoutMs = input.timeoutMs ?? 5_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) return "unavailable";
  const transport = selectedTransport(input);
  if (!transport) return "unavailable";
  if (transport === "https_gateway") {
    const body = await callGateway({
      path: "v1/readiness",
      method: "GET",
      url: input.gatewayUrl,
      secret: input.gatewaySecret,
      timeoutMs,
      fetchImpl: input.fetchImpl,
    });
    return body?.status === "ready" ? "ready" : "unavailable";
  }
  return checkTcpReadiness({ host: input.host, port: input.port, timeoutMs });
}

async function scanTcp(input: {
  bytes: Uint8Array;
  host?: string;
  port?: number;
  timeoutMs: number;
}): Promise<ClamAvStatus> {
  const connection = readClamAvConnection(input);
  if (!connection) return "unavailable";
  return new Promise((resolve) => {
    let socket: net.Socket;
    try {
      socket = net.createConnection(connection);
    } catch {
      resolve("unavailable");
      return;
    }
    let response = "";
    let settled = false;
    const finish = (status: ClamAvStatus) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(status);
    };
    socket.setTimeout(input.timeoutMs, () => finish("unavailable"));
    socket.on("error", () => finish("unavailable"));
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (response.length > 4096) return finish("unavailable");
      if (response.includes("FOUND")) finish("infected");
      else if (response.includes("OK")) finish("clean");
    });
    socket.on("close", () => {
      if (!settled) finish(response.includes("OK") ? "clean" : "unavailable");
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < input.bytes.byteLength; offset += 64 * 1024) {
        const chunk = Buffer.from(input.bytes.subarray(offset, offset + 64 * 1024));
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.byteLength);
        socket.write(length);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
  });
}

export async function scanClamAvBytes(input: {
  bytes: Uint8Array;
  transport?: ClamAvTransport;
  host?: string;
  port?: number;
  gatewayUrl?: string;
  gatewaySecret?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ClamAvStatus> {
  const timeoutMs = input.timeoutMs ?? 15_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) return "unavailable";
  const transport = selectedTransport(input);
  if (!transport) return "unavailable";
  if (transport === "https_gateway") {
    const body = await callGateway({
      path: "v1/scan",
      method: "POST",
      body: input.bytes,
      url: input.gatewayUrl,
      secret: input.gatewaySecret,
      timeoutMs,
      fetchImpl: input.fetchImpl,
    });
    return body?.status === "clean" || body?.status === "infected"
      ? body.status
      : "unavailable";
  }
  return scanTcp({ bytes: input.bytes, host: input.host, port: input.port, timeoutMs });
}
