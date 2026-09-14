import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("管理一覧は裁定本文・理由・fingerprint・idempotencyを取得しない", async () => {
  const repository = await read("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts");
  const adminWorkspace = repository.slice(
    repository.indexOf("export async function loadMonitorQualityReviewAdminWorkspace"),
  );
  const query = adminWorkspace.slice(
    adminWorkspace.indexOf('.from("cloud_monitor_quality_review_adjudications")'),
    adminWorkspace.indexOf("if (adjudications.error"),
  );
  assert.match(query, /independent_locked_at/);
  assert.match(query, /differences_revealed_at/);
  assert.match(query, /submitted_at/);
  assert.doesNotMatch(query, /independent_payload|draft_payload|final_payload|decision_reason|revocation_reason|response_fingerprint|idempotency_key/);
});

test("裁定migration未適用環境では管理画面を壊さず操作を閉じる", async () => {
  const repository = await read("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts");
  const page = await read("../src/app/admin/general-monitors/quality-review/page.tsx");
  assert.match(repository, /isMissingAdjudicationSchema/);
  assert.match(repository, /adjudicationConfigured: !adjudications\.error/);
  assert.match(page, /裁定用migrationは未適用です/);
  assert.match(page, /disabled=\{!data\.adjudicationConfigured\}/);
});

test("管理者割当は不一致1件・第三者独立性・外部送信なしの三確認を必須にする", async () => {
  const actions = await read("../src/app/admin/general-monitors/quality-review/actions.ts");
  const page = await read("../src/app/admin/general-monitors/quality-review/page.tsx");
  const action = actions.slice(
    actions.indexOf("export async function assignMonitorQualityReviewAdjudicationAction"),
    actions.indexOf("export async function revokeMonitorQualityReviewAdjudicationAction"),
  );
  assert.match(actions, /scopeConfirmation: z\.literal\("one_disagreement_case"\)/);
  assert.match(actions, /independenceConfirmation: z\.literal\("not_primary_reviewer"\)/);
  assert.match(actions, /deliveryConfirmation: z\.literal\("no_external_delivery"\)/);
  assert.match(action, /requireAdmin/);
  assert.match(action, /adjudication-\$\{crypto\.randomUUID\(\)\}/);
  assert.doesNotMatch(action, /sendCloudGeneralMonitor|recordMonitorQualityReviewNotification/);
  assert.match(page, /summary\.decision\.disagreementCaseKeys/);
  assert.match(page, /item\.reviewer_slot === "reviewer_a" \|\| item\.reviewer_slot === "reviewer_b"/);
});

test("裁定進捗は状態を分離し停止時も回答と監査履歴を保持する", async () => {
  const page = await read("../src/app/admin/general-monitors/quality-review/page.tsx");
  const actions = await read("../src/app/admin/general-monitors/quality-review/actions.ts");
  assert.match(page, /不一致\{decision\.requiredCount\}件中 \{decision\.submittedCount\}件確定/);
  for (const status of ["assigned", "in_progress", "independent_locked", "submitted", "abstained", "revoked"])
    assert.match(page, new RegExp(`${status}:`));
  assert.match(page, /裁定を停止（記録保持）/);
  assert.match(actions, /reason: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(500\)/);
  assert.match(actions, /confirmation: z\.literal\("revoke_with_history"\)/);
  assert.match(actions, /adjudication-revoke-\$\{crypto\.randomUUID\(\)\}/);
});

test("管理操作は専用RPCだけを使い既存回答・候補画像を変更しない", async () => {
  const repository = await read("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts");
  const slice = repository.slice(
    repository.indexOf("export async function monitorQualityReviewAdjudicationConfigured"),
    repository.indexOf("export async function loadMonitorQualityReviewNotificationTargets"),
  );
  assert.match(slice, /rpc\("assign_cloud_monitor_quality_review_adjudication"/);
  assert.match(slice, /rpc\("revoke_cloud_monitor_quality_review_adjudication"/);
  assert.doesNotMatch(slice, /cloud_monitor_quality_review_responses|candidate_storage_path|\.delete\(|\.update\(|\.insert\(/);
});
