import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildGeneralMonitorCsv, csvCell } from "../src/lib/cloud-general-monitor-export.ts";

test("CSVはUTF-8 BOMと安全な引用符で出力する", () => {
  assert.equal(csvCell('a"b'), '"a""b"');
  const csv=buildGeneralMonitorCsv([{displayName:"山田,花子",status:"active"}]);
  assert.equal(csv.startsWith("\uFEFF"),true);
  assert.match(csv,/"山田,花子"/);
});

test("運用migrationは本人オンボーディングと管理者レビューを分離する",async()=>{
  const sql=await readFile(new URL("../supabase/migrations/202607310001_cloud_general_monitor_operations.sql",import.meta.url),"utf8");
  assert.match(sql,/complete_cloud_general_monitor_onboarding/);
  assert.match(sql,/profile_id=public\.current_profile_id\(\)/);
  assert.match(sql,/review_cloud_general_monitor_feedback/);
  assert.match(sql,/role='admin'/);
  assert.match(sql,/revoke all .*authenticated/);
});

test("警告と初回案内は利用可能なモニターだけに表示される",async()=>{
  const [library,dashboard,monitor,welcome,welcomeAction]=await Promise.all([
    readFile(new URL("../src/lib/cloud-general-monitor.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/app/dashboard/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/app/dashboard/monitor/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/app/dashboard/monitor/welcome/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/app/dashboard/monitor/welcome/actions.ts",import.meta.url),"utf8"),
  ]);
  assert.match(library,/remaining <= 5/);
  assert.match(library,/daysRemaining <= 3/);
  assert.match(library,/getCloudGeneralMonitorUnavailableMessage/);
  assert.match(dashboard,/初回案内が未確認です/);
  assert.match(dashboard,/monitorActive && monitor && !monitor\.onboarding_completed_at/);
  assert.match(monitor,/isCloudGeneralMonitorActive\(enrollment\) && !enrollment\.onboarding_completed_at/);
  assert.match(welcome,/APIキー、パスワード、個人情報/);
  assert.match(welcome,/getCloudGeneralMonitorEnrollment/);
  assert.doesNotMatch(welcome,/requireCloudGeneralMonitor/);
  assert.match(welcome,/モニターを開始できません/);
  assert.match(welcomeAction,/safeDomainErrorMessage/);
});

test("管理画面はフィードバック対応とCSVを提供する",async()=>{
  const page=await readFile(new URL("../src/app/admin/general-monitors/page.tsx",import.meta.url),"utf8");
  assert.match(page,/reviewGeneralMonitorFeedbackAction/);
  assert.match(page,/general-monitors\/export/);
});
