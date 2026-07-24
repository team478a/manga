import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { z } from "zod";
import {
  readApiErrorCode,
  readApiErrorMessage,
} from "../src/lib/api-error-contract.ts";
import { toApiError } from "../src/lib/api-errors.ts";
import {
  AuthenticationRequiredError,
  DomainError,
  PermissionDeniedError,
  ResourceNotFoundError,
  RevisionConflictError,
  ValidationError,
} from "../src/lib/domain-errors.ts";
import { mapCanvasPersistenceError } from "../src/modules/cloud-creator/canvas/canvas-repository.ts";

test("Domain Errorを安定したcodeとHTTP statusへ変換する", () => {
  for (const [error, code, status] of [
    [new AuthenticationRequiredError(), "AUTHENTICATION_REQUIRED", 401],
    [new PermissionDeniedError(), "PERMISSION_DENIED", 403],
    [new ResourceNotFoundError(), "RESOURCE_NOT_FOUND", 404],
    [new RevisionConflictError(), "REVISION_CONFLICT", 409],
    [new ValidationError(), "VALIDATION_ERROR", 400],
  ]) {
    const response = toApiError(error, "fallback");
    assert.equal(response.body.errorCode, code);
    assert.equal(response.body.error, error.message);
    assert.equal(response.status, status);
  }
});

test("未知の例外内容をAPIへ露出しない", () => {
  const response = toApiError(
    new Error("database connection secret"),
    "保存に失敗しました。",
  );
  assert.deepEqual(response.body, {
    error: "保存に失敗しました。",
    errorCode: "INTERNAL_ERROR",
  });
  assert.equal(response.status, 500);
});

test("JSONとZod入力エラーをVALIDATION_ERRORへ正規化する", () => {
  for (const error of [
    new SyntaxError("bad json"),
    z.object({ id: z.string().uuid() }).safeParse({ id: "bad" }).error,
  ]) {
    const response = toApiError(error, "fallback");
    assert.equal(response.body.errorCode, "VALIDATION_ERROR");
    assert.equal(response.status, 400);
  }
});

test("移行期間中の文字列形式とobject形式のAPI Errorを読める", () => {
  assert.equal(
    readApiErrorMessage({ error: "従来メッセージ" }, "fallback"),
    "従来メッセージ",
  );
  assert.equal(
    readApiErrorMessage(
      { error: { code: "REVISION_CONFLICT", message: "競合しました。" } },
      "fallback",
    ),
    "競合しました。",
  );
  assert.equal(
    readApiErrorCode({
      error: { code: "REVISION_CONFLICT", message: "競合しました。" },
    }),
    "REVISION_CONFLICT",
  );
});

test("DB固有signalをRepository境界でDomain Errorへ変換する", () => {
  assert.equal(
    mapCanvasPersistenceError({ message: "revision_conflict:7" }).code,
    "REVISION_CONFLICT",
  );
  assert.equal(
    mapCanvasPersistenceError({ message: "page_not_found" }).code,
    "RESOURCE_NOT_FOUND",
  );
  assert.equal(
    mapCanvasPersistenceError({ message: "invalid_snapshot_input" }).code,
    "VALIDATION_ERROR",
  );
  assert.equal(
    mapCanvasPersistenceError({ message: "connection_failed" }).code,
    "INTERNAL_ERROR",
  );
});

test("Canvas ServiceとRouteはエラーメッセージ部分一致で分岐しない", async () => {
  for (const relative of [
    "../src/modules/cloud-creator/canvas/canvas-service.ts",
    "../src/app/api/creator/pages/[pageId]/snapshot/route.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /message\.includes|includes\(["']競合/);
  }
  const route = await readFile(
    new URL(
      "../src/app/api/creator/pages/[pageId]/snapshot/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(route, /toApiError/);
  const autosave = await readFile(
    new URL(
      "../src/app/creator/[projectId]/pages/[pageId]/hooks/useCanvasAutosave.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(autosave, /readApiErrorCode\(result\) === "REVISION_CONFLICT"/);
});

test("Domain Error codeは定義外の値を受け付けない型契約を持つ", () => {
  const error = new DomainError("INTERNAL_ERROR", "内部エラー");
  assert.equal(error.code, "INTERNAL_ERROR");
  assert.equal(error.name, "DomainError");
});
