import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import {
  checkClamAvReadiness,
  readClamAvGatewayConfig,
  scanClamAvBytes,
} from "../src/lib/external-submission-clamav.ts";
import {
  createGatewayServer,
  readGatewayConfig,
} from "../services/external-submission-clamav-gateway/gateway.mjs";

const SECRET = "test-secret-that-is-at-least-32-characters";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

function createFakeClamd() {
  const commands = [];
  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.subarray(0, 6).toString() === "zPING\0") {
        commands.push("PING");
        socket.end("PONG\0");
        return;
      }
      if (!buffer.subarray(0, 10).equals(Buffer.from("zINSTREAM\0"))) return;
      let offset = 10;
      const payload = [];
      while (buffer.byteLength >= offset + 4) {
        const length = buffer.readUInt32BE(offset);
        if (length === 0) {
          const bytes = Buffer.concat(payload);
          commands.push(bytes.toString("utf8"));
          socket.end(bytes.includes("EICAR") ? "stream: test FOUND\0" : "stream: OK\0");
          return;
        }
        if (buffer.byteLength < offset + 4 + length) return;
        payload.push(buffer.subarray(offset + 4, offset + 4 + length));
        offset += 4 + length;
      }
    });
  });
  return { server, commands };
}

test("gateway config requires a strong secret and explicit ClamAV host", () => {
  assert.equal(readGatewayConfig({}), null);
  assert.equal(readGatewayConfig({ MANGAI_CLAMAV_GATEWAY_SECRET: SECRET }), null);
  assert.equal(
    readGatewayConfig({
      MANGAI_CLAMAV_GATEWAY_SECRET: SECRET,
      MANGAI_CLAMAV_HOST: "clamd.internal",
    }),
    null,
  );
  assert.equal(
    readGatewayConfig({
      MANGAI_CLAMAV_GATEWAY_SECRET: SECRET,
      MANGAI_CLAMAV_HOST: "clamd.internal",
      MANGAI_CLAMAV_GATEWAY_TRUST_PROXY: "true",
    })?.trustProxy,
    true,
  );
  assert.equal(readClamAvGatewayConfig({ url: "https://gateway.example", secret: "short" }), null);
  assert.equal(readClamAvGatewayConfig({ url: "http://gateway.example", secret: SECRET }), null);
  assert.equal(
    readClamAvGatewayConfig({ url: "https://gateway.example/path", secret: SECRET }),
    null,
  );
  assert.deepEqual(
    readClamAvGatewayConfig({ url: "https://gateway.example", secret: SECRET }),
    { baseUrl: "https://gateway.example/", secret: SECRET },
  );
});

test("authenticated HTTPS gateway readiness and scan preserve ClamAV framing", async () => {
  const clam = createFakeClamd();
  const clamPort = await listen(clam.server);
  const gateway = createGatewayServer({
    secret: SECRET,
    clamavHost: "127.0.0.1",
    clamavPort: clamPort,
    port: 0,
    maxBytes: 1024,
    timeoutMs: 1000,
    requireHttps: false,
    trustProxy: false,
  });
  const gatewayPort = await listen(gateway);
  const common = {
    transport: "https_gateway",
    gatewayUrl: `http://127.0.0.1:${gatewayPort}`,
    gatewaySecret: SECRET,
    timeoutMs: 1000,
  };
  try {
    assert.equal(await checkClamAvReadiness(common), "ready");
    assert.equal(
      await scanClamAvBytes({ ...common, bytes: Buffer.from("clean fixture") }),
      "clean",
    );
    assert.equal(
      await scanClamAvBytes({ ...common, bytes: Buffer.from("EICAR fixture") }),
      "infected",
    );
    assert.deepEqual(clam.commands, ["PING", "clean fixture", "EICAR fixture"]);
  } finally {
    await close(gateway);
    await close(clam.server);
  }
});

test("gateway rejects missing auth, insecure forwarding, and oversized input", async () => {
  const gateway = createGatewayServer({
    secret: SECRET,
    clamavHost: "127.0.0.1",
    clamavPort: 3310,
    port: 0,
    maxBytes: 4,
    timeoutMs: 1000,
    requireHttps: true,
    trustProxy: true,
  });
  const port = await listen(gateway);
  try {
    const insecure = await fetch(`http://127.0.0.1:${port}/v1/readiness`, {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    assert.equal(insecure.status, 400);
    const unauthorized = await fetch(`http://127.0.0.1:${port}/v1/readiness`, {
      headers: { "x-forwarded-proto": "https" },
    });
    assert.equal(unauthorized.status, 401);
    const oversized = await fetch(`http://127.0.0.1:${port}/v1/scan`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${SECRET}`,
        "content-type": "application/octet-stream",
        "x-forwarded-proto": "https",
      },
      body: "12345",
    });
    assert.equal(oversized.status, 413);
  } finally {
    await close(gateway);
  }
});

test("Worker gateway client fails closed for auth and response errors", async () => {
  const unavailable = await scanClamAvBytes({
    bytes: Buffer.from("fixture"),
    transport: "https_gateway",
    gatewayUrl: "https://gateway.example",
    gatewaySecret: SECRET,
    fetchImpl: async () => new Response(JSON.stringify({ status: "unknown" }), { status: 200 }),
  });
  assert.equal(unavailable, "unavailable");
  assert.equal(
    await checkClamAvReadiness({
      transport: "https_gateway",
      gatewayUrl: "https://gateway.example",
      gatewaySecret: SECRET,
      fetchImpl: async () => new Response("unauthorized", { status: 401 }),
    }),
    "unavailable",
  );
  const previousTransport = process.env.MANGAI_EXTERNAL_CLAMAV_TRANSPORT;
  process.env.MANGAI_EXTERNAL_CLAMAV_TRANSPORT = "invalid";
  try {
    assert.equal(await scanClamAvBytes({ bytes: Buffer.from("fixture") }), "unavailable");
  } finally {
    if (previousTransport === undefined) delete process.env.MANGAI_EXTERNAL_CLAMAV_TRANSPORT;
    else process.env.MANGAI_EXTERNAL_CLAMAV_TRANSPORT = previousTransport;
  }
  assert.equal(
    await checkClamAvReadiness({ transport: "https_gateway", timeoutMs: 0 }),
    "unavailable",
  );
});
