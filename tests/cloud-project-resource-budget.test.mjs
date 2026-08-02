import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { cloudProjectBudgetSchema, isProjectUsageWarning, usagePercent } from "../src/lib/cloud-project-budget.ts";

test("作品別生成上限の入力と警告率を検証する", () => {
  const valid = { projectId: crypto.randomUUID(), monthlyCreditLimit: "100", monthlyCostLimitMicros: 10_000_000, storageLimitBytes: 512 * 1024 * 1024, warningPercent: 80, generationEnabled: true };
  assert.equal(cloudProjectBudgetSchema.safeParse(valid).success, true);
  assert.equal(cloudProjectBudgetSchema.safeParse({ ...valid, warningPercent: 49 }).success, false);
  assert.equal(cloudProjectBudgetSchema.safeParse({ ...valid, monthlyCreditLimit: "0" }).success, false);
  assert.equal(usagePercent(80, 100), 80);
  assert.equal(isProjectUsageWarning(80, 100, 80), true);
  assert.equal(isProjectUsageWarning(10, null, 80), false);
});

test("DBが作品別credit・費用・容量を同時実行下で停止する", () => {
  const migration = fs.readFileSync("supabase/migrations/202608010010_cloud_project_resource_budgets.sql", "utf8");
  for (const expected of ["for update", "cloud_project_credit_limit_exceeded", "cloud_project_cost_limit_exceeded", "cloud_project_storage_limit_exceeded", "cloud_project_generation_disabled"]) assert.match(migration, new RegExp(expected));
});

test("コックピットは集計のみを表示してProvider詳細を露出しない", () => {
  const page = fs.readFileSync("src/app/creator/[projectId]/cockpit/page.tsx", "utf8");
  for (const expected of ["作品の生成量・費用・容量", "今月の生成credit", "今月の推定費用", "作品の保存容量", "上限到達時は新しい生成をDB側で停止"]) assert.match(page, new RegExp(expected));
  assert.doesNotMatch(page, /provider_id|model_id|pricing_version/);
});
