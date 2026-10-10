import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { checkClamAvReadiness } from "../src/lib/external-submission-clamav.ts";

async function withClamAvServer(reply, action) {
  const commands = [];
  const server = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      commands.push(chunk.toString("utf8"));
      socket.end(reply);
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  try {
    return await action({ port: address.port, commands });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("ClamAV preflight sends framed PING and accepts only PONG", async () => {
  await withClamAvServer("PONG\0", async ({ port, commands }) => {
    const status = await checkClamAvReadiness({
      host: "127.0.0.1",
      port,
      timeoutMs: 1_000,
    });
    assert.equal(status, "ready");
    assert.deepEqual(commands, ["zPING\0"]);
  });
  await withClamAvServer("UNKNOWN\0", async ({ port }) => {
    assert.equal(
      await checkClamAvReadiness({
        host: "127.0.0.1",
        port,
        timeoutMs: 1_000,
      }),
      "unavailable",
    );
  });
});

test("ClamAV preflight fails closed for missing or invalid connection settings", async () => {
  assert.equal(
    await checkClamAvReadiness({ host: "", port: 3310, timeoutMs: 10 }),
    "unavailable",
  );
  assert.equal(
    await checkClamAvReadiness({ host: "127.0.0.1", port: 0, timeoutMs: 10 }),
    "unavailable",
  );
});
