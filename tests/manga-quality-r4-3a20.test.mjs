import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  monitorQualityReviewAdjudicationDifferenceSchema,
} from "../src/modules/manga-quality/domain/monitor-quality-review-adjudication.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("匿名差分schemaは必要最小限の判定だけを許可する", () => {
  const valid = {
    case_key: "case_000003",
    reviewer_a: { verdict: "good", defects: [] },
    reviewer_b: {
      verdict: "bad",
      defects: [{ category: "anatomy_hand_error", severity: "major" }],
    },
  };
  assert.equal(monitorQualityReviewAdjudicationDifferenceSchema.safeParse(valid).success, true);
  assert.equal(monitorQualityReviewAdjudicationDifferenceSchema.safeParse({
    ...valid,
    reviewer_a: { ...valid.reviewer_a, comment: "private" },
  }).success, false);
  assert.equal(monitorQualityReviewAdjudicationDifferenceSchema.safeParse({
    ...valid,
    reviewer_profile_id: "secret-profile",
  }).success, false);
});

test("担当者workspaceは本人の割当だけを読み込み未完了を優先する", async () => {
  const repository = await read("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts");
  const workspace = repository.slice(
    repository.indexOf("export async function loadMonitorQualityReviewAdjudicationWorkspace"),
    repository.indexOf("export async function createMonitorQualityReviewCandidateUrl"),
  );
  assert.match(workspace, /\.eq\("adjudicator_profile_id", adjudicatorProfileId\)/);
  assert.match(workspace, /pendingStatuses/);
  assert.match(workspace, /adjudicationId\s*\? rows\.find\(\(item\) => item\.id === adjudicationId\)/);
  assert.match(workspace, /rows\.find\(\(item\) => pendingStatuses\.has\(item\.status\)\)/);
  assert.match(workspace, /batch\.data\?\.status !== "completed"/);
  assert.doesNotMatch(workspace, /final_payload|decision_reason|revocation_reason/);
});

test("候補画像URLは現在の本人割当とcase一致を再確認して短時間署名する", async () => {
  const repository = await read("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts");
  const candidate = repository.slice(
    repository.indexOf("export async function createMonitorQualityReviewAdjudicationCandidateUrl"),
    repository.indexOf("export async function consentMonitorQualityReview"),
  );
  assert.match(candidate, /loadMonitorQualityReviewAdjudicationWorkspace\(input\.adjudicatorProfileId\)/);
  assert.match(candidate, /workspace\.adjudication\?\.id !== input\.adjudicationId/);
  assert.match(candidate, /workspace\.reviewCase\?\.id !== input\.caseId/);
  assert.match(candidate, /createSignedUrl\(storedCase\.data\.candidate_storage_path, 120\)/);
});

test("裁定APIは本人権限と明示確認を要求し各操作前にworkspaceを再取得する", async () => {
  const route = await read("../src/app/api/monitor/quality-review/adjudication/route.ts");
  assert.match(route, /requireProfile\(\)/);
  assert.match(route, /requireCloudGeneralMonitor\(profile\.id\)/);
  assert.match(route, /loadMonitorQualityReviewAdjudicationWorkspace\([\s\S]*profile\.id,[\s\S]*input\.adjudicationId/);
  assert.match(route, /confirmation: z\.literal\("lock_blind_judgment"\)/);
  assert.match(route, /confirmation: z\.literal\("reveal_anonymous_differences"\)/);
  assert.match(route, /confirmation: z\.literal\("submit_final_adjudication"\)/);
  assert.match(route, /confirmation: z\.literal\("abstain_with_reason"\)/);
  assert.match(route, /idempotencyKeySchema/);
});

test("Blind-first境界は独立確定前の差分開示と開示前の最終送信を拒否する", async () => {
  const route = await read("../src/app/api/monitor/quality-review/adjudication/route.ts");
  assert.match(route, /workspace\.adjudication\.status !== "independent_locked"/);
  assert.match(route, /独立判定を確定してから差分を表示してください/);
  assert.match(route, /!workspace\.adjudication\.differences_revealed_at/);
  assert.match(route, /匿名差分を確認してから最終裁定を送信してください/);
  assert.match(route, /monitorQualityReviewAdjudicationDifferenceSchema\.safeParse/);
});

test("担当者画面は独立判定を固定してから匿名差分と最終裁定を表示する", async () => {
  const client = await read("../src/app/dashboard/monitor/quality-review/MonitorQualityReviewAdjudicationClient.tsx");
  assert.ok(client.indexOf("1. ご自身の独立判定") < client.indexOf("2. 匿名差分と最終裁定"));
  assert.match(client, /独立判定を変更不可で確定/);
  assert.match(client, /匿名回答 A/);
  assert.match(client, /匿名回答 B/);
  assert.match(client, /氏名やコメントは表示しません/);
  assert.match(client, /independentLocked && independentDraft \? independentDraft : draft/);
  assert.doesNotMatch(client, /Primary Reviewer|reviewer_profile_id|display_name|email/);
});

test("担当者画面は途中保存・再開・拡大・一時障害再送に対応する", async () => {
  const client = await read("../src/app/dashboard/monitor/quality-review/MonitorQualityReviewAdjudicationClient.tsx");
  assert.match(client, /setTimeout\(async \(\) =>/);
  assert.match(client, /action: "save"/);
  assert.match(client, /props\.adjudication\.independentDraft \?\? props\.adjudication\.draft/);
  assert.match(client, /aria-label="画像を拡大表示"/);
  assert.match(client, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(client, /body: JSON\.stringify\(body\)/);
  assert.match(client, /response\.status < 500 && response\.status !== 429/);
});

test("裁定画面は元回答・画像・採用状態を変更する経路を持たない", async () => {
  const files = [
    await read("../src/app/api/monitor/quality-review/adjudication/route.ts"),
    await read("../src/app/dashboard/monitor/quality-review/MonitorQualityReviewAdjudicationClient.tsx"),
  ].join("\n");
  assert.doesNotMatch(files, /sendCloudGeneralMonitor|recordMonitorQualityReviewNotification/);
  assert.doesNotMatch(files, /adopt|candidate.*delete|storage\.from.*remove|provider|credit/i);
  assert.match(files, /元の回答や画像は削除されません/);
});

test("品質確認ページは未完了裁定を優先し次の割当でclientを再初期化する", async () => {
  const page = await read("../src/app/dashboard/monitor/quality-review/page.tsx");
  assert.match(page, /loadMonitorQualityReviewAdjudicationWorkspace/);
  assert.match(page, /\["assigned", "in_progress", "independent_locked"\]/);
  assert.match(page, /adjudicationIsPending \|\| !workspace\.assignment/);
  assert.match(page, /key=\{adjudicationWorkspace\.adjudication\.id\}/);
});
