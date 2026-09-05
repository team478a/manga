import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MONITOR_INTRINSIC_DEFECT_CATEGORIES,
  monitorQualityReviewDraftSchema,
  validateCompletedMonitorQualityReview,
} from "../src/modules/manga-quality/domain/monitor-quality-review.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("モニター品質確認は既存Human Review record契約で完成判定する", () => {
  const draft = monitorQualityReviewDraftSchema.parse({
    caseId: "11111111-1111-4111-8111-111111111111",
    verdict: "bad",
    confidence: 4,
    defects: [{ category: "anatomy_hand_error", severity: "major", comment: "" }],
    overallComment: "指の形が不自然です。",
    complete: true,
  });
  const record = validateCompletedMonitorQualityReview({
    caseKey: "case_000001",
    allowedDefectCategories: [...MONITOR_INTRINSIC_DEFECT_CATEGORIES],
    draft,
  });
  assert.equal(record.case_id, "case_000001");
  assert.equal(record.verdict, "bad");
  assert.equal(record.defects[0].category, "anatomy_hand_error");
});

test("良好判定への欠陥混在と不良判定の欠陥欠落を拒否する", () => {
  const base = {
    caseId: "11111111-1111-4111-8111-111111111111",
    confidence: 4,
    overallComment: "",
    complete: true,
  };
  for (const invalid of [
    { ...base, verdict: "good", defects: [{ category: "crop_error", severity: "minor", comment: "" }] },
    { ...base, verdict: "bad", defects: [] },
  ]) {
    const draft = monitorQualityReviewDraftSchema.parse(invalid);
    assert.throws(() => validateCompletedMonitorQualityReview({
      caseKey: "case_000001",
      allowedDefectCategories: [...MONITOR_INTRINSIC_DEFECT_CATEGORIES],
      draft,
    }));
  }
});

test("Feature Flagは未設定時fail closedしモニター招待と二重に検査する", async () => {
  const [flag, page, route, imageRoute] = await Promise.all([
    read("../src/lib/monitor-quality-review.ts"),
    read("../src/app/dashboard/monitor/quality-review/page.tsx"),
    read("../src/app/api/monitor/quality-review/route.ts"),
    read("../src/app/api/monitor/quality-review/image/route.ts"),
  ]);
  assert.match(flag, /MANGAI_MONITOR_QUALITY_REVIEW_ENABLED/);
  assert.match(route, /assertMonitorQualityReviewEnabled/);
  assert.match(route, /requireCloudGeneralMonitor/);
  assert.match(imageRoute, /requireCloudGeneralMonitor/);
  assert.match(page, /isCloudGeneralMonitorActive/);
});

test("migrationは回答のblind分離・A\/B独立・本人限定RPCを強制する", async () => {
  const sql = await read("../supabase/migrations/202608180001_cloud_monitor_quality_review.sql");
  assert.match(sql, /unique\(batch_id,reviewer_profile_id\)/);
  assert.match(sql, /unique\(batch_id,reviewer_slot\)/);
  assert.match(sql, /reviewer_profile_id=v_profile/);
  assert.match(sql, /not public\.can_use_cloud_general_monitor\(\)/);
  assert.match(sql, /consented_at is not null/);
  assert.match(sql, /revoke all on public\.cloud_monitor_quality_review_batches[\s\S]*from public,anon,authenticated/);
  assert.match(sql, /grant execute on function[\s\S]*public\.save_cloud_monitor_quality_review_case[\s\S]*to authenticated,service_role/);
  assert.doesNotMatch(sql, /provider_id|model_id|prompt|signed_url|adult/i);
});

test("画像は割当を再確認して短時間署名URLだけを返す", async () => {
  const repository = await read("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts");
  assert.match(repository, /workspace\.assignment\?\.id !== input\.assignmentId/);
  assert.match(repository, /workspace\.cases\.find/);
  assert.match(repository, /createSignedUrl\(storedCase\.candidate_storage_path, 120\)/);
  assert.doesNotMatch(repository, /getPublicUrl/);
});

test("利用者UIはスマートフォン向け途中保存・再開・全件送信を備える", async () => {
  const client = await read("../src/app/dashboard/monitor/quality-review/MonitorQualityReviewClient.tsx");
  for (const phrase of ["下書きを保存", "後から再開", "この画像の判定を確定", "すべての判定を送信"])
    assert.match(client, new RegExp(phrase));
  assert.match(client, /grid gap-5 lg:grid-cols/);
  assert.match(client, /setTimeout/);
  assert.match(client, /saveQueue/);
  assert.match(client, /enqueueSave/);
});

test("確定済み回答は遅延した下書き保存で未確定へ戻らない", async () => {
  const migration = await read("../supabase/migrations/202609050001_monitor_quality_review_completion_race.sql");
  assert.match(migration, /case_completed_at is not null and not p_complete/);
  assert.match(migration, /cloud_monitor_quality_review_responses\.response_payload/);
  assert.match(migration, /cloud_monitor_quality_review_responses\.case_completed_at/);
});

test("管理画面は進捗のみ表示し回答payloadを取得しない", async () => {
  const [page, repository] = await Promise.all([
    read("../src/app/admin/general-monitors/quality-review/page.tsx"),
    read("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts"),
  ]);
  assert.match(page, /Reviewer A/);
  assert.match(page, /Reviewer B/);
  const adminLoader = repository.slice(
    repository.indexOf("export async function loadMonitorQualityReviewAdminWorkspace"),
    repository.indexOf("export async function assignMonitorQualityReview"),
  );
  assert.doesNotMatch(adminLoader, /response_payload/);
  assert.match(adminLoader, /case_completed_at/);
});

test("管理画面は未提出かつ未送信の担当者だけへ開始案内を送り送信履歴を保持する", async () => {
  const [page, actions, repository, migration] = await Promise.all([
    read("../src/app/admin/general-monitors/quality-review/page.tsx"),
    read("../src/app/admin/general-monitors/quality-review/actions.ts"),
    read("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts"),
    read("../supabase/migrations/202609010001_cloud_monitor_quality_review_notifications.sql"),
  ]);
  assert.match(page, /未提出・未送信.*名へ開始案内を送信/);
  assert.match(page, /提出済み担当者には送信しません/);
  assert.match(page, /confirmation/);
  assert.match(actions, /!item\.notification_sent_at && item\.status !== "submitted" && !item\.submitted_at/);
  assert.match(repository, /id,reviewer_profile_id,status,submitted_at,notification_sent_at/);
  assert.match(actions, /sendCloudGeneralMonitorQualityReviewStartEmail/);
  assert.match(repository, /record_cloud_monitor_quality_review_notification_sent/);
  assert.match(migration, /notification_sent_at/);
  assert.match(migration, /notification_send_count/);
  assert.match(migration, /auth\.role\(\)<>'service_role'/);
});

test("送信済み回答だけを既存Human Review v2形式で非キャッシュ出力する", async () => {
  const route = await read("../src/app/admin/general-monitors/quality-review/export/route.ts");
  assert.match(route, /requireAdmin/);
  assert.match(route, /humanReviewResponseSchema\.parse/);
  assert.match(route, /mangai-human-review-v2/);
  assert.match(route, /private, no-store/);
  assert.match(route, /reviewer_kind: "human"/);
  assert.match(route, /independent: true/);
});
