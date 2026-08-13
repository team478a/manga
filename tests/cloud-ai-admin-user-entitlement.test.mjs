import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCloudAiAdminEntitlementPeriod } from "../src/modules/cloud-ai/domain/admin-user-entitlement.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("admin付与は既存Planに対応する新しい期間を作る", () => {
  const now = new Date("2026-08-13T04:00:00.000Z");
  const trial = buildCloudAiAdminEntitlementPeriod({
    planKey: "trial",
    durationDays: 30,
    now,
  });
  assert.deepEqual(trial, {
    plan_key: "trial",
    status: "trialing",
    source: "admin",
    period_starts_at: "2026-08-13T04:00:00.000Z",
    period_ends_at: "2026-09-12T04:00:00.000Z",
    updated_at: "2026-08-13T04:00:00.000Z",
  });
  assert.equal(
    buildCloudAiAdminEntitlementPeriod({
      planKey: "creator",
      durationDays: 1,
      now,
    }).status,
    "active",
  );
});

test("個別利用枠actionは管理者確認後にCloud AI repositoryを呼ぶ", async () => {
  const action = await read("src/app/admin/users/[id]/cloud-ai-actions.ts");
  const start = action.indexOf("export async function updateCloudAiUserEntitlementAction");
  assert.ok(start >= 0);
  assert.ok(
    action.indexOf("await requireAdmin()", start) <
      action.indexOf("updateCloudAiAdminUserEntitlement(", start),
  );
  assert.match(action, /recordCloudAiAdminAudit/);
  assert.match(action, /update_user_entitlement/);
  assert.match(action, /durationDays: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(90\)/);
  assert.doesNotMatch(action, /createAdminClient|SUPABASE_SERVICE_ROLE_KEY/);
});

test("個別利用枠repositoryは課金中・予約中・処理中の上書きを拒否する", async () => {
  const repository = await read(
    "src/modules/cloud-ai/infrastructure/admin-cloud-ai-repository.ts",
  );
  assert.match(repository, /before\.source === "stripe"/);
  assert.match(repository, /credits_reserved/);
  assert.match(repository, /\.in\("status", \["queued", "running"\]\)/);
  assert.match(repository, /\.in\("source", \["default", "admin"\]\)/);
  assert.match(repository, /\.eq\("active", true\)/);
  assert.doesNotMatch(
    repository,
    /MANGAI_CLOUD_AI_WORKER_SECRET|authorization|Bearer/,
  );
});

test("ユーザー詳細は個別Plan、利用量、安全な変更条件を表示する", async () => {
  const page = await read("src/app/admin/users/[id]/page.tsx");
  for (const label of [
    "個別利用枠",
    "使用／予約credit",
    "処理中Job",
    "Stripe契約中です",
    "予約中creditまたは処理中Jobがある場合は変更を拒否します",
  ])
    assert.match(page, new RegExp(label));
  assert.match(page, /loadCloudAiAdminUserEntitlement/);
});
