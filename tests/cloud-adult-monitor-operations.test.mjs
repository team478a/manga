import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("adult monitor operations migration keeps onboarding, feedback and email controls server-side", () => {
  const sql = read("supabase/migrations/202607310004_cloud_adult_monitor_operations.sql");
  for (const required of [
    "onboarding_completed_at",
    "review_cloud_adult_monitor_feedback",
    "set_cloud_adult_monitor_email_template",
    "service_role",
    "{{welcome_url}}",
  ]) assert.match(sql, new RegExp(required.replace(/[{}]/g, "\\$&")));
  assert.doesNotMatch(sql, /api_key\s+text/i);
});

test("adult monitor invite uses the dedicated welcome route and hides provider errors", () => {
  const email = read("src/lib/cloud-general-monitor-email.ts");
  const action = read("src/app/admin/users/[id]/adult-monitor-actions.ts");
  assert.match(email, /dashboard\/adult-monitor\/welcome/);
  assert.match(email, /sendCloudAdultMonitorInviteEmail/);
  assert.match(action, /メールを送信できませんでした/);
  assert.doesNotMatch(action, /error\.message/);
});

test("adult monitor web guidance states the non-image and private boundaries", () => {
  const welcome = read("src/app/dashboard/adult-monitor/welcome/page.tsx");
  const guide = read("src/app/dashboard/adult-monitor/guide/page.tsx");
  assert.match(welcome, /18歳以上/);
  assert.match(welcome, /画像生成は今回の対象外/);
  assert.match(guide, /非公開/);
});
