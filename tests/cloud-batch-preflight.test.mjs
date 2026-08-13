import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { estimateGenerationBatch } from "../src/modules/manga/domain/generation-batch-preflight.ts";

const context = (overrides = {}) => ({
  available: true,
  providerEnabled: true,
  modelId: "flux-2-pro",
  pricingVersion: "bfl-flux2-2026-03",
  currency: "USD",
  creditsPerJob: 2,
  maxCostMicrosPerJob: 30_000,
  planKey: "creator",
  entitlementStatus: "active",
  planGenerationEnabled: true,
  planCreditsRemaining: 100,
  planCostMicrosRemaining: 10_000_000,
  projectGenerationEnabled: true,
  projectCreditsRemaining: null,
  projectCostMicrosRemaining: null,
  globalGenerationEnabled: true,
  globalCostMicrosRemaining: 100_000_000,
  monitorActive: true,
  monitorRequestsRemaining: 100,
  userRequestsPerMinute: 30,
  projectRequestsPerMinute: 20,
  pagePanelCounts: { a: 2, b: 3, c: 1, d: 4, e: 12 },
  visualReadinessAvailable: true,
  styleBibleConfigured: true,
  configuredCharacterNames: ["主人公", "相棒", "敵"],
  pageCharacterNames: {
    a: ["主人公"],
    b: ["主人公", "相棒"],
    c: [],
    d: ["敵"],
    e: ["未設定人物"],
  },
  schedulerJobsPerRun: 3,
  schedulerIntervalMinutes: 5,
  ...overrides,
});

test("選択ページの画風と登場人物設定が不足する場合は有料一括生成を拒否する", () => {
  const estimate = estimateGenerationBatch(context({
    styleBibleConfigured: false,
    configuredCharacterNames: ["主人公"],
  }), ["a", "b", "c", "d"]);
  assert.equal(estimate.canStart, false);
  assert.deepEqual(estimate.requiredCharacterNames, ["主人公", "相棒", "敵"]);
  assert.deepEqual(estimate.missingCharacterNames, ["相棒", "敵"]);
  assert.match(estimate.blockers.join("\n"), /作品全体の画風が未設定/);
  assert.match(estimate.blockers.join("\n"), /相棒、敵/);
  assert.doesNotMatch(estimate.blockers.join("\n"), /未設定人物/);
});

test("人物・画風を確認できない状態はfail-closedにする", () => {
  const estimate = estimateGenerationBatch(context({
    visualReadinessAvailable: false,
  }), ["a", "b", "c", "d"]);
  assert.equal(estimate.canStart, false);
  assert.match(estimate.blockers.join("\n"), /人物・画風の生成準備を確認できません/);
});

test("一括生成preflightは対象コマ、credit、最大予約費用、Worker下限を合算する", () => {
  const estimate = estimateGenerationBatch(context(), ["a", "b", "c", "d"]);
  assert.equal(estimate.selectedPageCount, 4);
  assert.equal(estimate.targetPanelCount, 10);
  assert.equal(estimate.requiredCredits, 20);
  assert.equal(estimate.maxReservedCostMicros, 300_000);
  assert.equal(estimate.schedulerRuns, 4);
  assert.equal(estimate.schedulerMinimumMinutes, 20);
  assert.equal(estimate.registrationLimit, 20);
  assert.equal(estimate.canStart, true);
});

test("plan、作品、global、monitorの不足はbatch作成前のblockerになる", () => {
  const estimate = estimateGenerationBatch(context({
    planCreditsRemaining: 19,
    projectCreditsRemaining: 18,
    globalCostMicrosRemaining: 299_999,
    monitorRequestsRemaining: 9,
  }), ["a", "b", "c", "d"]);
  assert.equal(estimate.canStart, false);
  assert.match(estimate.blockers.join("\n"), /Cloud AI creditが1不足/);
  assert.match(estimate.blockers.join("\n"), /作品の生成creditが2不足/);
  assert.match(estimate.blockers.join("\n"), /全体の日次費用上限/);
  assert.match(estimate.blockers.join("\n"), /モニターAI利用枠が1回不足/);
});

test("現在snapshot欠損は拒否し、1分上限超過はdurable Job化へ委ねる", () => {
  const estimate = estimateGenerationBatch(context({
    projectRequestsPerMinute: 6,
    pagePanelCounts: { a: 2, b: 3, c: null, d: 4 },
  }), ["a", "b", "c", "d"]);
  assert.equal(estimate.targetPanelCount, 9);
  assert.equal(estimate.canStart, false);
  assert.match(estimate.blockers.join("\n"), /Canvasを確認できない/);
  assert.doesNotMatch(estimate.blockers.join("\n"), /1分登録上限/);
  const complete = estimateGenerationBatch(context({
    projectRequestsPerMinute: 6,
    pagePanelCounts: { a: 2, b: 3, c: 1, d: 4 },
  }), ["a", "b", "c", "d"]);
  assert.equal(complete.targetPanelCount, 10);
  assert.equal(complete.registrationLimit, 6);
  assert.equal(complete.canStart, true);
});

test("選択ページの一部だけにコマがある状態を全ページ成功として扱わない", () => {
  const estimate = estimateGenerationBatch(context({
    pagePanelCounts: { a: 2, b: 3, c: 0, d: 4 },
  }), ["a", "b", "c", "d"]);
  assert.equal(estimate.targetPanelCount, 9);
  assert.equal(estimate.canStart, false);
  assert.match(estimate.blockers.join("\n"), /生成可能なコマがないページ/);
});

test("画面とServer Actionは見積り、全件永続登録、段階Job化を明示する", () => {
  const component = fs.readFileSync(new URL("../src/app/creator/[projectId]/LongformPageManager.tsx", import.meta.url), "utf8");
  const actions = fs.readFileSync(new URL("../src/app/creator/actions.ts", import.meta.url), "utf8");
  const service = fs.readFileSync(new URL("../src/modules/cloud-creator/generation/batch-production-service.ts", import.meta.url), "utf8");
  for (const expected of ["開始前の生成見積り", "必要credit", "最大予約費用", "料金版", "1分Job化上限", "生成前のビジュアル準備", "画風・世界観を設定", "キャラクター設定を追加", "Job化済み"])
    assert.match(component, new RegExp(expected));
  assert.match(actions, /result\.registered/);
  assert.match(actions, /Workerが利用上限を守って順番に生成/);
  assert.match(service, /assertCloudGenerationBatchPreflight/);
  assert.match(service, /create_cloud_generation_batch_targets/);
});

test("preflight serviceは採用ネームと現行人物・画風versionだけを確認する", () => {
  const service = fs.readFileSync(new URL("../src/modules/cloud-creator/generation/batch-preflight-service.ts", import.meta.url), "utf8");
  for (const expected of [
    "cloud_story_storyboard_projects",
    "cloud_story_storyboard_versions",
    "cloud_story_scenario_versions",
    "cloud_character_profiles",
    "cloud_character_profile_versions",
    "cloud_style_bibles",
    "cloud_style_bible_versions",
  ]) assert.match(service, new RegExp(expected));
  assert.match(service, /hasCharacterVisualDetails/);
  assert.match(service, /version\.appearance_age\.trim\(\) &&/);
  assert.match(service, /style\.art_style\.trim\(\) &&/);
  assert.match(service, /visualReadinessAvailable: true/);
});
