import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toApiError, toMessageApiError } from "../src/lib/api-errors.ts";
import {
  ProviderUnavailableError,
  ResourceNotFoundError,
  RevisionConflictError,
  StorageTransactionError,
  ValidationError,
} from "../src/lib/domain-errors.ts";

test("Webhook失敗をmessage互換codeとHTTP statusへ変換する", () => {
  for (const [error, code, status] of [
    [new ValidationError("署名不正"), "VALIDATION_ERROR", 400],
    [
      new ProviderUnavailableError("設定不足"),
      "PROVIDER_UNAVAILABLE",
      503,
    ],
  ]) {
    const response = toMessageApiError(error, "fallback");
    assert.equal(response.body.errorCode, code);
    assert.equal(response.status, status);
  }
});

test("購入download失敗を未検出・Storage・競合へ分類する", () => {
  for (const [error, code, status] of [
    [new ResourceNotFoundError(), "RESOURCE_NOT_FOUND", 404],
    [new StorageTransactionError(), "STORAGE_TRANSACTION_ERROR", 500],
    [new RevisionConflictError(), "REVISION_CONFLICT", 409],
  ]) {
    const response = toApiError(error, "fallback");
    assert.equal(response.body.errorCode, code);
    assert.equal(response.status, status);
  }
});

test("Webhookと購入download Routeは共通Error契約を使う", async () => {
  const webhook = await readFile(
    new URL("../src/app/api/stripe/webhook/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(webhook, /toMessageApiError/);
  assert.doesNotMatch(
    webhook,
    /error instanceof Error\s*\?\s*error\.message/,
  );

  const download = await readFile(
    new URL(
      "../src/app/api/purchases/[orderId]/download/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(download, /toApiError/);
  assert.match(download, /NextResponse\.redirect\(signedUrl,\s*303\)/);
});

test("決済・購入Serviceは生のErrorを生成しない", async () => {
  for (const relative of [
    "../src/lib/payments.ts",
    "../src/lib/purchases.ts",
    "../src/lib/stripe.ts",
    "../src/lib/subscription-events.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /throw new Error\(/);
  }
});

test("購入download Serviceは所有者・paid条件と5分期限を維持する", async () => {
  const source = await readFile(
    new URL("../src/lib/purchases.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /\.eq\("buyer_profile_id", buyerProfileId\)/);
  assert.match(source, /\.eq\("status", "paid"\)/);
  assert.match(source, /createSignedUrl\([^,]+,\s*300,/s);
  assert.match(source, /record_order_download/);
});
