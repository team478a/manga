import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  safeDomainErrorMessage,
  toMessageApiError,
} from "../src/lib/api-errors.ts";
import {
  normalizeBuyerEmail,
  resolveCheckoutOrigin,
} from "../src/lib/checkout-policy.ts";
import { ValidationError } from "../src/lib/domain-errors.ts";

test("message互換API Errorへcodeとstatusを追加する", () => {
  assert.deepEqual(
    toMessageApiError(new ValidationError("入力を確認してください。"), "fallback"),
    {
      body: {
        message: "入力を確認してください。",
        errorCode: "VALIDATION_ERROR",
      },
      status: 400,
    },
  );
  assert.deepEqual(
    toMessageApiError(new Error("database secret"), "処理に失敗しました。"),
    {
      body: {
        message: "処理に失敗しました。",
        errorCode: "INTERNAL_ERROR",
      },
      status: 500,
    },
  );
});

test("redirectへDomain Errorだけを表示し未知例外を秘匿する", () => {
  assert.equal(
    safeDomainErrorMessage(
      new ValidationError("利用者向けメッセージ"),
      "fallback",
    ),
    "利用者向けメッセージ",
  );
  assert.equal(
    safeDomainErrorMessage(new Error("database secret"), "fallback"),
    "fallback",
  );
});

test("Checkout入力とServer設定を用途別Domain Errorへ変換する", () => {
  assert.throws(
    () => normalizeBuyerEmail("invalid"),
    (error) => error.code === "VALIDATION_ERROR",
  );
  assert.throws(
    () =>
      resolveCheckoutOrigin({
        configured: undefined,
        requestOrigin: "https://example.com",
        production: true,
      }),
    (error) => error.code === "PROVIDER_UNAVAILABLE",
  );
});

test("Checkout・Billing・Desktop Routeは生の例外メッセージを返さない", async () => {
  for (const relative of [
    "../src/app/api/checkout/create-session/route.ts",
    "../src/app/api/billing/checkout/route.ts",
    "../src/app/api/billing/portal/route.ts",
    "../src/app/api/desktop/device/authorize/route.ts",
    "../src/app/api/desktop/device/token/route.ts",
    "../src/app/api/desktop/projects/[sourceProjectId]/status/route.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /error instanceof Error\s*\?\s*error\.message/,
    );
    assert.match(source, /toMessageApiError|safeDomainErrorMessage/);
  }
});

test("決済・端末認証Serviceは生のErrorを生成しない", async () => {
  for (const relative of [
    "../src/lib/checkout.ts",
    "../src/lib/cloud-subscriptions.ts",
    "../src/lib/desktop-auth.ts",
    "../src/lib/desktop-device-rate-limit.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /throw new Error\(/);
  }
});
