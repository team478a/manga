import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkCloudAdultStoryboardEnvironment } from "../scripts/check-cloud-adult-storyboard-preflight.mjs";

test("成人向けAIネームFeature Flagは未設定時fail closedする", async () => {
  const source = await readFile(new URL("../src/lib/cloud-adult-storyboard.ts", import.meta.url), "utf8");
  assert.match(source, /CLOUD_ADULT_STORYBOARD_GENERATION_ENABLED\?\.toLowerCase\(\) === "true"/);
});

test("成人向けAIネームmigrationは許可・同意・Kill Switch・区分RLSを要求する", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202607300008_cloud_adult_storyboard.sql", import.meta.url), "utf8");
  assert.match(sql, /adult_storyboard/);
  assert.match(sql, /cloud_adult_storyboard_settings/);
  assert.match(sql, /cloud_adult_storyboard_consents/);
  assert.match(sql, /adult-ai-storyboard-v1/);
  assert.match(sql, /can_use_cloud_adult_storyboard/);
  assert.match(sql, /scenario\.content_class=cloud_story_storyboard_versions\.content_class/);
  assert.match(sql, /parent\.content_class=cloud_story_storyboard_versions\.content_class/);
});

test("成人向けネームはCanvasと画像生成の直前で停止する", async () => {
  const detail = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/versions/[storyboardVersionId]/page.tsx", import.meta.url), "utf8");
  const actions = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/actions.ts", import.meta.url), "utf8");
  assert.match(detail, /成人向けCanvas／画像生成には進みません/);
  assert.match(actions, /version\.content_class !== "general"/);
  assert.doesNotMatch(detail, /min-w-\[/);
});

test("成人向けネームpreflightは値を表示せず必要な設定名だけを検査する", () => {
  const env = Object.fromEntries([
    "NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY",
    "CLOUD_RESEARCH_MVP_ENABLED","CLOUD_PROPOSAL_GENERATION_ENABLED",
    "CLOUD_SCENARIO_GENERATION_ENABLED","CLOUD_STORYBOARD_GENERATION_ENABLED",
    "CLOUD_ADULT_RESEARCH_ENABLED","CLOUD_ADULT_AI_PLANNING_ENABLED",
    "CLOUD_ADULT_SCENARIO_GENERATION_ENABLED","CLOUD_ADULT_STORYBOARD_GENERATION_ENABLED",
  ].map((key) => [key, "configured-secret"]));
  const result = checkCloudAdultStoryboardEnvironment(env);
  assert.equal(result.passed, true);
  assert.equal(JSON.stringify(result).includes("configured-secret"), false);
});
