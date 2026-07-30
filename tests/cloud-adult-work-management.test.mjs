import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkCloudAdultWorkManagementEnvironment } from "../scripts/check-cloud-adult-work-management-preflight.mjs";

test("成人向け作品管理Feature Flagは未設定時fail closedする", async () => {
  const source = await readFile(
    new URL("../src/lib/cloud-adult-work-management.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /CLOUD_ADULT_WORK_MANAGEMENT_ENABLED\?\.toLowerCase\(\) === "true"/,
  );
});

test("成人向け作品管理migrationは本人限定・非公開・18歳以上を固定する", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202607300010_cloud_adult_work_management.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /owner_profile_id=public\.current_profile_id\(\)/);
  assert.match(sql, /project\.content_class='adult'/);
  assert.match(sql, /project\.visibility='private'/);
  assert.match(sql, /visibility='private',age_rating='18歳以上'/);
  assert.match(sql, /public\.can_use_cloud_adult_work_management\(\)/);
});

test("成人向け作品画面は公開・販売を提供せず安全な書き出しだけを表示する", async () => {
  const page = await readFile(
    new URL(
      "../src/app/dashboard/adult-works/[projectId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /format=pdf/);
  assert.match(page, /format=images/);
  assert.match(page, /公開、共同編集、Marketplace、販売パッケージ、Cloud画像生成は利用できません/);
  assert.doesNotMatch(page, /format=package/);
});

test("成人向け作品管理preflightは値を表示せず設定名だけを検査する", () => {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CLOUD_ADULT_RESEARCH_ENABLED",
    "CLOUD_ADULT_AI_PLANNING_ENABLED",
    "CLOUD_ADULT_SCENARIO_GENERATION_ENABLED",
    "CLOUD_ADULT_STORYBOARD_GENERATION_ENABLED",
    "CLOUD_ADULT_CANVAS_ENABLED",
    "CLOUD_ADULT_WORK_MANAGEMENT_ENABLED",
  ];
  const env = Object.fromEntries(keys.map((key) => [key, "hidden-value"]));
  const result = checkCloudAdultWorkManagementEnvironment(env);
  assert.equal(result.passed, true);
  assert.equal(JSON.stringify(result).includes("hidden-value"), false);
});
