import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { safeDomainErrorMessage } from "../src/lib/api-errors.ts";
import {
  PayloadTooLargeError,
  ValidationError,
} from "../src/lib/domain-errors.ts";

const actionFiles = [
  "../src/app/actions/auth-actions.ts",
  "../src/app/actions/checkout-actions.ts",
  "../src/app/actions/goods-request-actions.ts",
  "../src/app/actions/product-actions.ts",
  "../src/app/actions/profile-actions.ts",
  "../src/app/actions/work-actions.ts",
  "../src/app/admin/cloud-ai/actions.ts",
  "../src/app/creator/actions.ts",
  "../src/app/dashboard/devices/actions.ts",
  "../src/app/dashboard/import-package/actions.ts",
  "../src/app/dashboard/notifications/actions.ts",
  "../src/app/sales-packages/actions.ts",
];

test("Hub Server Actionは未知例外の生メッセージをredirectへ渡さない", async () => {
  for (const relative of actionFiles) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /error instanceof Error\s*\?\s*error\.message/,
      relative,
    );
    assert.doesNotMatch(
      source,
      /encodeURIComponent\([^)]*error(?:\?|\.)?\.message/,
      relative,
    );
  }
});

test("Action共有処理と販売package取込は生のErrorを生成しない", async () => {
  for (const relative of [
    "../src/app/actions/shared/file-validation.ts",
    "../src/app/actions/shared/storage-transaction.ts",
    "../src/app/dashboard/import-package/actions.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /throw new Error\(/, relative);
  }
});

test("入力ErrorだけをAction表示へ許可し未知例外を秘匿する", () => {
  assert.equal(
    safeDomainErrorMessage(
      new ValidationError("入力を確認してください。"),
      "fallback",
    ),
    "入力を確認してください。",
  );
  assert.equal(
    safeDomainErrorMessage(new Error("database secret"), "fallback"),
    "fallback",
  );
});

test("file検証は入力不正と容量超過を別codeへ分類する", () => {
  assert.equal(new ValidationError().code, "VALIDATION_ERROR");
  assert.equal(new PayloadTooLargeError().code, "PAYLOAD_TOO_LARGE");
});

test("通知と管理Actionは入力・DB失敗を型付きErrorへ変換する", async () => {
  const notifications = await readFile(
    new URL(
      "../src/app/dashboard/notifications/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(notifications, /ValidationError/);
  assert.match(notifications, /new DomainError/);
  assert.doesNotMatch(notifications, /\.uuid\(\)\.parse\(/);

  const admin = await readFile(
    new URL("../src/app/admin/cloud-ai/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(admin, /new DomainError/);
  assert.match(admin, /safeParse\(id\)/);
});
