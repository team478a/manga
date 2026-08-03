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
  const [library,dashboard,dashboardError,monitor,welcome,startButton,onboardingApi,welcomeError]=await Promise.all([
    readFile(new URL("../src/lib/cloud-general-monitor.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/app/dashboard/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/app/dashboard/error.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/app/dashboard/monitor/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/app/dashboard/monitor/welcome/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/app/dashboard/monitor/welcome/MonitorStartButton.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/app/api/monitor/onboarding/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/app/dashboard/monitor/welcome/error.tsx",import.meta.url),"utf8"),
  ]);
  assert.match(library,/remaining <= 5/);
  assert.match(library,/daysRemaining <= 3/);
  assert.match(library,/getCloudGeneralMonitorUnavailableMessage/);
  assert.match(dashboard,/初回案内が未確認です/);
  assert.match(dashboard,/Promise\.allSettled/);
  assert.match(dashboard,/role="status"/);
  assert.match(dashboardError,/操作内容は失われていません/);
  assert.match(dashboardError,/reset/);
  assert.match(dashboard,/monitorActive && monitor && !monitor\.onboarding_completed_at/);
  assert.match(monitor,/isCloudGeneralMonitorActive\(enrollment\) && !enrollment\.onboarding_completed_at/);
  assert.match(welcome,/APIキー、パスワード、個人情報/);
  assert.match(welcome,/getCloudGeneralMonitorEnrollment/);
  assert.doesNotMatch(welcome,/requireCloudGeneralMonitor/);
  assert.match(welcome,/モニターを開始できません/);
  assert.match(welcome,/MonitorStartButton/);
  assert.doesNotMatch(welcome,/<form action=/);
  assert.match(startButton,/fetch\("\/api\/monitor\/onboarding"/);
  assert.match(startButton,/開始準備中/);
  assert.match(startButton,/role="alert"/);
  assert.match(onboardingApi,/getCurrentProfile/);
  assert.match(onboardingApi,/requireCloudGeneralMonitor/);
  assert.match(onboardingApi,/complete_cloud_general_monitor_onboarding/);
  assert.match(onboardingApi,/toApiError/);
  assert.match(onboardingApi,/isSameOriginRequest/);
  assert.match(welcomeError,/画面を読み込めませんでした/);
  assert.match(welcomeError,/reset/);
});

test("管理画面はフィードバック対応とCSVを提供する",async()=>{
  const page=await readFile(new URL("../src/app/admin/general-monitors/page.tsx",import.meta.url),"utf8");
  assert.match(page,/reviewGeneralMonitorFeedbackAction/);
  assert.match(page,/general-monitors\/export/);
});
