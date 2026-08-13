import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toApiError } from "../src/lib/api-errors.ts";
import { CloudGenerationLeaseLostError } from "../src/lib/cloud-ai-worker.ts";
import {
  cloudModerationRejectedError,
  mapCloudGenerationBatchRegistrationError,
  mapCloudGenerationEnqueueError,
} from "../src/modules/cloud-creator/generation/generation-errors.ts";

test("Cloud AI quotaとrate limit DB signalを安定codeへ変換する", () => {
  for (const [signal, code, status] of [
    ["cloud_credit_quota_exceeded", "QUOTA_EXCEEDED", 429],
    ["cloud_cost_quota_exceeded", "QUOTA_EXCEEDED", 429],
    ["cloud_daily_budget_exceeded", "QUOTA_EXCEEDED", 429],
    ["cloud_generation_rate_limited", "RATE_LIMITED", 429],
  ]) {
    const error = mapCloudGenerationEnqueueError({ message: signal });
    const response = toApiError(error, "fallback");
    assert.equal(error.code, code);
    assert.equal(response.status, status);
  }
});

test("Cloud AI停止・契約・入力エラーを用途別codeへ変換する", () => {
  for (const [signal, code, status] of [
    ["cloud_generation_disabled", "PROVIDER_UNAVAILABLE", 503],
    ["cloud_generation_price_unavailable", "PROVIDER_UNAVAILABLE", 503],
    ["cloud_entitlement_inactive", "PERMISSION_DENIED", 403],
    ["cloud_generation_input_rejected", "VALIDATION_ERROR", 400],
    ["cloud_project_not_editable", "PERMISSION_DENIED", 403],
  ]) {
    const response = toApiError(
      mapCloudGenerationEnqueueError({ message: signal }),
      "fallback",
    );
    assert.equal(response.body.errorCode, code);
    assert.equal(response.status, status);
  }
});

test("未知のCloud AI DB signalをINTERNAL_ERRORとして秘匿する", () => {
  const response = toApiError(
    mapCloudGenerationEnqueueError({
      message: "database_secret_internal_failure",
    }),
    "fallback",
  );
  assert.deepEqual(response.body, {
    error: "Cloud AI Jobを登録できませんでした。",
    errorCode: "INTERNAL_ERROR",
  });
  assert.equal(response.status, 500);
});

test("一括生成登録の固定DB signalを安全なcodeへ変換する", () => {
  for (const [signal, code, status] of [
    ["cloud_batch_targets_access_denied", "PERMISSION_DENIED", 403],
    ["cloud_batch_targets_count_invalid", "VALIDATION_ERROR", 400],
    ["cloud_batch_targets_page_revision_invalid", "REVISION_CONFLICT", 409],
    ["cloud_batch_targets_pricing_invalid", "PROVIDER_UNAVAILABLE", 503],
    ["cloud_batch_targets_panel_invalid", "REVISION_CONFLICT", 409],
    ["cloud_batch_targets_payload_invalid", "VALIDATION_ERROR", 400],
    ["cloud_batch_targets_uniqueness_invalid", "VALIDATION_ERROR", 400],
    ["cloud_batch_targets_insert_invalid", "INTERNAL_ERROR", 500],
  ]) {
    const response = toApiError(
      mapCloudGenerationBatchRegistrationError({ message: signal }),
      "fallback",
    );
    assert.equal(response.body.errorCode, code);
    assert.equal(response.status, status);
  }
});

test("一括生成登録の未知DB情報とPostgREST詳細を画面へ漏らさない", () => {
  const unknown = toApiError(
    mapCloudGenerationBatchRegistrationError({
      message: "database_secret_internal_failure: prompt=private",
    }),
    "fallback",
  );
  assert.deepEqual(unknown.body, {
    error: "一括生成targetを永続登録できませんでした。",
    errorCode: "INTERNAL_ERROR",
  });

  const missingRpc = toApiError(
    mapCloudGenerationBatchRegistrationError({
      code: "PGRST202",
      message: "Could not find the function public.private_detail",
    }),
    "fallback",
  );
  assert.deepEqual(missingRpc.body, {
    error: "一括生成の登録機能を読み込めませんでした。時間をおいて再度お試しください。",
    errorCode: "PROVIDER_UNAVAILABLE",
  });
});

test("moderation拒否とWorker lease喪失が型付きcodeを持つ", () => {
  const moderation = toApiError(
    cloudModerationRejectedError(["adult_content"]),
    "fallback",
  );
  assert.equal(moderation.body.errorCode, "CONTENT_REJECTED");
  assert.equal(moderation.status, 422);

  const lease = new CloudGenerationLeaseLostError();
  assert.equal(lease.code, "LEASE_LOST");
  assert.equal(toApiError(lease, "fallback").status, 409);
});

test("Cloud AI API Routeは日本語メッセージ部分一致で分岐しない", async () => {
  for (const relative of [
    "../src/modules/cloud-ai/presentation/generation-route.ts",
    "../src/app/api/creator/ai-quota/route.ts",
    "../src/app/api/internal/cloud-ai/worker/route.ts",
    "../src/modules/cloud-creator/generation/generation-service.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /message\.includes|includes\(["'](?:集中|拒否|停止中)/);
    assert.match(source, /toApiError|mapCloudGenerationEnqueueError/);
  }
});
