import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkCloudAdultCanvasEnvironment } from "../scripts/check-cloud-adult-canvas-preflight.mjs";
import { assertGeneralStoryboardProject } from "../src/lib/cloud-panel-image-generation.ts";

test("成人向けCanvas Feature Flagは未設定時fail closedする", async () => {
  const source = await readFile(
    new URL("../src/lib/cloud-storyboard-materialization.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /CLOUD_ADULT_CANVAS_ENABLED\?\.toLowerCase\(\) === "true"/,
  );
});

test("成人向けCanvas migrationは区分を保持し本人だけに編集を許可する", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/202607300009_cloud_adult_canvas.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /content_class in\('general','adult'\)/);
  assert.match(sql, /age_rating in\('全年齢','12歳以上','15歳以上','18歳以上'\)/);
  assert.match(sql, /project\.owner_profile_id=public\.current_profile_id\(\)/);
  assert.match(sql, /public\.can_use_cloud_adult_storyboard\(\)/);
  assert.match(sql, /'contentClass',v_content_class/);
});

test("成人向けCanvasを一般向け画像生成へ渡さない", () => {
  assert.throws(
    () =>
      assertGeneralStoryboardProject({
        materializationFound: true,
        ownerProfileId: "10000000-0000-4000-8000-000000000001",
        expectedOwnerProfileId: "10000000-0000-4000-8000-000000000001",
        materializationContentClass: "adult",
        storyboardContentClass: "adult",
      }),
    /一般向け/,
  );
});

test("成人向けProjectは画像生成とMarketplace導線を表示しない", async () => {
  const [canvasPage, projectPage, editor] = await Promise.all([
    readFile(
      new URL("../src/app/creator/[projectId]/pages/[pageId]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/creator/[projectId]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(canvasPage, /workspace\.project\.content_class === "general"/);
  assert.match(projectPage, /成人向け・非公開/);
  assert.match(projectPage, /project\.content_class === "general"/);
  assert.match(editor, /project\.content_class === "general"/);
});

test("成人向けCanvas preflightは値を表示せず設定名だけを検査する", () => {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CLOUD_RESEARCH_MVP_ENABLED",
    "CLOUD_PROPOSAL_GENERATION_ENABLED",
    "CLOUD_SCENARIO_GENERATION_ENABLED",
    "CLOUD_STORYBOARD_GENERATION_ENABLED",
    "CLOUD_STORYBOARD_CANVAS_ENABLED",
    "CLOUD_ADULT_RESEARCH_ENABLED",
    "CLOUD_ADULT_AI_PLANNING_ENABLED",
    "CLOUD_ADULT_SCENARIO_GENERATION_ENABLED",
    "CLOUD_ADULT_STORYBOARD_GENERATION_ENABLED",
    "CLOUD_ADULT_CANVAS_ENABLED",
  ];
  const env = Object.fromEntries(keys.map((key) => [key, "configured-secret"]));
  const result = checkCloudAdultCanvasEnvironment(env);
  assert.equal(result.passed, true);
  assert.equal(JSON.stringify(result).includes("configured-secret"), false);
});
