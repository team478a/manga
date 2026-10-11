import { timingSafeEqual } from "node:crypto";
import http from "node:http";
import net from "node:net";

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

function integer(value, fallback, minimum, maximum) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

export function readGatewayConfig(env = process.env) {
  const secret = env.MANGAI_CLAMAV_GATEWAY_SECRET;
  const clamavHost = env.MANGAI_CLAMAV_HOST;
  const clamavPort = integer(env.MANGAI_CLAMAV_PORT, 3310, 1, 65535);
  const port = integer(env.PORT, 8080, 1, 65535);
  const maxBytes = integer(env.MANGAI_CLAMAV_GATEWAY_MAX_BYTES, DEFAULT_MAX_BYTES, 1, DEFAULT_MAX_BYTES);
  const timeoutMs = integer(env.MANGAI_CLAMAV_GATEWAY_TIMEOUT_MS, 15000, 1000, 60000);
  const requireHttps = env.MANGAI_CLAMAV_GATEWAY_REQUIRE_HTTPS !== "false";
  const trustProxy = env.MANGAI_CLAMAV_GATEWAY_TRUST_PROXY === "true";
  if (
    !secret ||
    secret.length < 32 ||
    !clamavHost ||
    !clamavPort ||
    !port ||
    !maxBytes ||
    !timeoutMs ||
    (requireHttps && !trustProxy)
  )
    return null;
  return {
    secret,
    clamavHost,
    clamavPort,
    port,
    maxBytes,
    timeoutMs,
    requireHttps,
    trustProxy,
  };
}

function authorized(request, secret) {
  const prefix = "Bearer ";
  const header = request.headers.authorization ?? "";
  if (!header.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);
  return provided.byteLength === expected.byteLength && timingSafeEqual(provided, expected);
}

function usesHttps(request, trustProxy) {
  if (request.socket.encrypted) return true;
  if (!trustProxy) return false;
  return (request.headers["x-forwarded-proto"] ?? "")
    .split(",")
    .some((value) => value.trim().toLowerCase() === "https");
}

function send(response, statusCode, body) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readBody(request, maxBytes) {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (!Number.isInteger(declared) || declared < 1 || declared > maxBytes) return null;
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.byteLength;
    if (total > maxBytes) return null;
    chunks.push(chunk);
  }
  return total === declared ? Buffer.concat(chunks, total) : null;
}

function parseClamdResponse(response) {
  if (response.includes("FOUND")) return "infected";
  if (response.includes("OK")) return "clean";
  return "unavailable";
}

export function checkClamd({ host, port, timeoutMs }) {
  return new Promise((resolve) => {
    let socket;
    let response = "";
    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      socket?.destroy();
      resolve(status);
    };
    try {
      socket = net.createConnection({ host, port });
    } catch {
      finish("unavailable");
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
    socket.on("connect", () => socket.write("zPING\0"));
  });
}

export function scanWithClamd(bytes, { host, port, timeoutMs }) {
  return new Promise((resolve) => {
    let socket;
    let response = "";
    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      socket?.destroy();
      resolve(status);
    };
    try {
      socket = net.createConnection({ host, port });
    } catch {
      finish("unavailable");
      return;
    }
    socket.setTimeout(timeoutMs, () => finish("unavailable"));
    socket.on("error", () => finish("unavailable"));
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (response.length > 4096) return finish("unavailable");
      const status = parseClamdResponse(response);
      if (status !== "unavailable") finish(status);
    });
    socket.on("close", () => {
      if (!settled) finish(parseClamdResponse(response));
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.byteLength; offset += 64 * 1024) {
        const chunk = bytes.subarray(offset, offset + 64 * 1024);
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.byteLength);
        socket.write(length);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
  });
}

export function createGatewayServer(config) {
  let scanActive = false;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://gateway.invalid");
    if (request.method === "GET" && url.pathname === "/healthz") {
      send(response, 200, { status: "ok" });
      return;
    }
    if (config.requireHttps && !usesHttps(request, config.trustProxy)) {
      send(response, 400, { status: "unavailable" });
      return;
    }
    if (!authorized(request, config.secret)) {
      send(response, 401, { status: "unauthorized" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/readiness") {
      const status = await checkClamd({
        host: config.clamavHost,
        port: config.clamavPort,
        timeoutMs: config.timeoutMs,
      });
      send(response, status === "ready" ? 200 : 503, { status });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/scan") {
      if (request.headers["content-type"] !== "application/octet-stream") {
        send(response, 415, { status: "unavailable" });
        return;
      }
      if (scanActive) {
        send(response, 429, { status: "unavailable" });
        return;
      }
      scanActive = true;
      try {
        const bytes = await readBody(request, config.maxBytes);
        if (!bytes) {
          send(response, 413, { status: "unavailable" });
          return;
        }
        const status = await scanWithClamd(bytes, {
          host: config.clamavHost,
          port: config.clamavPort,
          timeoutMs: config.timeoutMs,
        });
        send(response, status === "unavailable" ? 503 : 200, { status });
      } catch {
        if (!response.headersSent) send(response, 503, { status: "unavailable" });
        else response.destroy();
      } finally {
        scanActive = false;
      }
      return;
    }
    send(response, 404, { status: "not_found" });
  });
  server.requestTimeout = config.timeoutMs;
  server.headersTimeout = config.timeoutMs;
  return server;
}
