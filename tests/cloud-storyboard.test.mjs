import assert from "node:assert/strict";
import test from "node:test";
import { cloudStoryboardFeatureEnabled, cloudStoryboardResultSchema } from "../src/lib/cloud-storyboard.ts";
import { runCloudStoryboardAi } from "../src/lib/cloud-storyboard-ai.ts";
import { createCloudStoryboardVersionWithPersistence, getCloudStoryboardVersionWithPersistence, adoptCloudStoryboardWithPersistence } from "../src/lib/cloud-storyboard-persistence.ts";

const profileId = "10000000-0000-4000-8000-000000000001";
const reportId = "20000000-0000-4000-8000-000000000001";
const scenarioId = "50000000-0000-4000-8000-000000000001";
const storyboardId = "70000000-0000-4000-8000-000000000001";
const page = (pageNumber) => ({
  pageNumber, sceneIndex: Math.min(pageNumber, 8), purpose: `ページ${pageNumber}の目的`,
  pageTurnHook: "次の選択を見たくなる。",
  panels: [{ index: 1, shot: "medium", cameraAngle: "eye_level", composition: "主人公を右手前に置く。", characters: ["明日香"], background: "駅前", action: "主人公が一歩を踏み出す。", emotion: "迷いから決意へ", dialogue: [{ type: "speech", speaker: "明日香", text: "行こう。" }], visualDirection: "一般向け漫画の明るい駅前。" }],
});
const body = {
  title: "再出発の約束・ネーム", pageCount: 8, readingDirection: "rtl",
  pages: Array.from({ length: 8 }, (_, index) => page(index + 1)),
  productionNotes: { pageRhythm: "前半を速く、終盤を大きく見せる。", visualMotifs: ["朝日"], continuityRisks: ["衣装の連続性"] },
};
const result = { engineVersion: "openai-storyboard-v1", generatedAt: "2026-07-30T00:00:00.000Z", model: "gpt-5.6-terra", classification: "ai_inference", containsGeneratedMarketNumbers: false, ...body };
const scenario = { id: scenarioId, research_report_id: reportId, proposal_selection_id: "40000000-0000-4000-8000-000000000001", result: { pageCount: 8, title: "再出発の約束", scenes: [] } };
const report = { id: reportId, input: { contentClass: "general" } };
const version = { id: storyboardId, owner_profile_id: profileId, scenario_version_id: scenarioId, parent_version_id: null, revision_instruction: null, result, engine_version: "openai-storyboard-v1", completed_at: result.generatedAt, created_at: result.generatedAt };
const persistence = (overrides = {}) => ({
  insertVersion: async () => ({ data: { id: storyboardId }, error: null }),
  listVersions: async () => ({ data: [version], error: null }),
  findVersion: async () => ({ data: version, error: null }),
  insertAdoption: async () => ({ data: { id: "80000000-0000-4000-8000-000000000001" }, error: null }),
  findLatestAdoption: async () => ({ data: null, error: null }),
  ...overrides,
});

test("Release 4 Feature Flagは未設定時fail closedする", () => {
  const previous = process.env.CLOUD_STORYBOARD_GENERATION_ENABLED;
  delete process.env.CLOUD_STORYBOARD_GENERATION_ENABLED;
  assert.equal(cloudStoryboardFeatureEnabled(), false);
  if (previous !== undefined) process.env.CLOUD_STORYBOARD_GENERATION_ENABLED = previous;
});
test("ネームschemaは総ページ・ページ番号・コマ番号を検証する", () => {
  assert.equal(cloudStoryboardResultSchema.parse(result).pages.length, 8);
  assert.equal(cloudStoryboardResultSchema.safeParse({ ...result, pages: result.pages.map((item, index) => index === 1 ? { ...item, pageNumber: 9 } : item) }).success, false);
});
test("採用シナリオから構造化ネームを生成しProvider保存を無効化する", async () => {
  let request;
  const generated = await runCloudStoryboardAi({
    profileId, report, scenario, now: result.generatedAt,
    runtimeConfig: { apiKey: "sk-test-00000000000000000000", model: "gpt-5.6-terra" },
    fetchImplementation: async (_url, init) => { request = JSON.parse(init.body); return new Response(JSON.stringify({ output_text: JSON.stringify(body) })); },
  });
  assert.equal(generated.pages.length, 8);
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 32_000);
  assert.ok(!JSON.stringify(request).includes("sk-test"));
});
test("成人向けはProvider呼出前に拒否する", async () => {
  let called = false;
  await assert.rejects(runCloudStoryboardAi({
    profileId, report: { ...report, input: { contentClass: "adult" } }, scenario,
    runtimeConfig: { apiKey: "sk-test-00000000000000000000", model: "gpt-5.6-terra" },
    fetchImplementation: async () => { called = true; return new Response(); },
  }), /外部AIへ送信しません/);
  assert.equal(called, false);
});
test("ネームsnapshotを保存し不正UUIDをDB参照前に拒否する", async () => {
  let saved;
  await createCloudStoryboardVersionWithPersistence({ profileId, scenarioVersionId: scenarioId, result, persistence: persistence({ insertVersion: async (value) => { saved = value; return { data: { id: storyboardId }, error: null }; } }) });
  assert.deepEqual(saved.result, result);
  let queried = false;
  await assert.rejects(getCloudStoryboardVersionWithPersistence({ profileId, versionId: "invalid", persistence: persistence({ findVersion: async () => { queried = true; return { data: null, error: null }; } }) }), /見つかりません/);
  assert.equal(queried, false);
});
test("同じ採用版は冪等に既存eventを返す", async () => {
  const id = "80000000-0000-4000-8000-000000000001";
  const adopted = await adoptCloudStoryboardWithPersistence({ profileId, version, persistence: persistence({ findLatestAdoption: async () => ({ data: { id, owner_profile_id: profileId, scenario_version_id: scenarioId, storyboard_version_id: storyboardId, adopted_at: result.generatedAt }, error: null }) }) });
  assert.equal(adopted, id);
});
test("同時採用の一意制約競合は保存済みeventへ収束する", async () => {
  let lookupCount = 0;
  const adoptionId = "80000000-0000-4000-8000-000000000002";
  const adopted = await adoptCloudStoryboardWithPersistence({
    profileId,
    version,
    persistence: persistence({
      findLatestAdoption: async () => {
        lookupCount += 1;
        return lookupCount === 1
          ? { data: null, error: null }
          : {
              data: {
                id: adoptionId,
                owner_profile_id: profileId,
                scenario_version_id: scenarioId,
                storyboard_version_id: storyboardId,
                adopted_at: result.generatedAt,
              },
              error: null,
            };
      },
      insertAdoption: async () => ({ data: null, error: { code: "23505" } }),
    }),
  });
  assert.equal(adopted, adoptionId);
});
