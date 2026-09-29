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
  assert.match(download, /request\.headers\.get\("sec-fetch-mode"\) === "navigate"/);
  assert.match(download, /requestOriginFromHeaders\(request\.headers\)/);
  assert.match(download, /new URL\("\/dashboard\/purchases", origin\)/);
  assert.match(download, /destination\.searchParams\.set\([\s\S]*"download_error"[\s\S]*response\.body\.errorCode/);
  assert.match(download, /NextResponse\.redirect\(destination, 303\)/);
  assert.match(download, /NextResponse\.json\(response\.body/);
});

test("購入downloadの画面表示は既知codeだけを安全な再試行案内へ変換する", async () => {
  const { purchaseDownloadFailureMessage } = await import(
    "../src/lib/purchase-download-feedback.ts"
  );

  assert.match(
    purchaseDownloadFailureMessage("RESOURCE_NOT_FOUND"),
    /購入履歴を再読み込み/,
  );
  assert.match(
    purchaseDownloadFailureMessage("REVISION_CONFLICT"),
    /現在の状態を確認/,
  );
  assert.match(
    purchaseDownloadFailureMessage("STORAGE_TRANSACTION_ERROR"),
    /もう一度お試しください/,
  );
  assert.equal(purchaseDownloadFailureMessage("UNKNOWN_ERROR"), null);
  assert.equal(purchaseDownloadFailureMessage(), null);
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
