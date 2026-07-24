import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ValidationError } from "../src/lib/domain-errors.ts";
import {
  attachHubRequestId,
  createHubRequestContext,
  logHubError,
  logHubEvent,
  sanitizeHubLogValue,
} from "../src/lib/hub-logger.ts";

test("Hub structured logは秘密値・創作内容・個人情報をredactする", () => {
  const sanitized = JSON.stringify(
    sanitizeHubLogValue({
      authorization: "Bearer device-secret",
      apiKey: "sk-test-secret-value",
      prompt: "private manga prompt",
      input_image_bytes: "private-image",
      buyer_email: "buyer@example.com",
      message:
        "contact author@example.com?token=secret-token and Bearer another-secret",
      nested: { password: "password-value" },
    }),
  );
  assert.doesNotMatch(
    sanitized,
    /device-secret|secret-value|private manga|private-image|buyer@example|author@example|secret-token|another-secret|password-value/,
  );
  assert.match(sanitized, /\[REDACTED/);
});

test("未知Errorはmessageとstackを記録せずDomain Error codeだけを残す", () => {
  assert.deepEqual(sanitizeHubLogValue(new Error("database secret")), {
    name: "Error",
    code: "INTERNAL_ERROR",
  });
  assert.deepEqual(
    sanitizeHubLogValue(new ValidationError("利用者入力を確認してください。")),
    {
      name: "ValidationError",
      code: "VALIDATION_ERROR",
    },
  );
  assert.deepEqual(
    sanitizeHubLogValue({
      error: {
        message: "database table secret",
        details: "private row",
        hint: "internal schema",
      },
    }),
    {
      error: {
        name: "UnknownError",
        code: "INTERNAL_ERROR",
      },
    },
  );
});

test("request IDは安全な受信値を使い不正値をUUIDへ置き換える", () => {
  const accepted = createHubRequestContext(
    new Request("https://hub.example/api/test?token=secret", {
      method: "post",
      headers: { "x-request-id": "edge:request-123" },
    }),
  );
  assert.deepEqual(accepted, {
    requestId: "edge:request-123",
    method: "POST",
    path: "/api/test",
  });
  const replaced = createHubRequestContext(
    {
      url: "https://hub.example/api/test",
      method: "GET",
      headers: { get: () => "invalid request id\nsecret" },
    },
  );
  assert.match(replaced.requestId, /^[0-9a-f-]{36}$/);
  const response = new Response(null);
  assert.equal(
    attachHubRequestId(response, accepted).headers.get("x-mangai-request-id"),
    "edge:request-123",
  );
});

test("1行JSONへ共通fieldと相関contextを出力する", () => {
  const output = [];
  const written = logHubEvent(
    "info",
    "stripe_webhook_processed",
    { requestId: "request-1", eventId: "evt_1" },
    {
      minLevel: "debug",
      now: () => new Date("2026-07-24T00:00:00.000Z"),
      write: (line, level) => output.push({ line, level }),
    },
  );
  assert.equal(written, true);
  assert.equal(output.length, 1);
  assert.doesNotMatch(output[0].line, /\r|\n/);
  assert.deepEqual(JSON.parse(output[0].line), {
    at: "2026-07-24T00:00:00.000Z",
    level: "info",
    service: "mangai-hub",
    event: "stripe_webhook_processed",
    context: { requestId: "request-1", eventId: "evt_1" },
  });
});

test("log levelを適用しlogger内部失敗を業務処理へ伝播しない", () => {
  assert.equal(
    logHubEvent("debug", "hidden", {}, { minLevel: "info", write: () => {} }),
    false,
  );
  assert.doesNotThrow(() =>
    logHubError("write_failed", new Error("secret"), {}, {
      minLevel: "debug",
      write: () => {
        throw new Error("sink failed");
      },
    }),
  );
});

test("主要Hub運用経路は共通loggerを使いconsoleへ直書きしない", async () => {
  for (const relative of [
    "../src/app/api/stripe/webhook/route.ts",
    "../src/app/api/purchases/[orderId]/download/route.ts",
    "../src/app/api/internal/cloud-ai/worker/route.ts",
    "../src/app/api/desktop/device/authorize/route.ts",
    "../src/app/api/desktop/device/token/route.ts",
    "../src/app/api/desktop/projects/[sourceProjectId]/status/route.ts",
    "../src/lib/cloud-ai-worker.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /logHub(?:Error|Event)/, relative);
    assert.doesNotMatch(source, /console\.(?:log|info|warn|error|debug)/, relative);
  }
});
