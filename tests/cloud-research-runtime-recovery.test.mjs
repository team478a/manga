import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("市場分析履歴の読込失敗は新規分析の入口を残して画面内で案内する", async () => {
  const page = await source("../src/app/dashboard/research/page.tsx");
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /historyUnavailable/);
  assert.match(page, /新しい市場分析はそのまま開始できます/);
  assert.match(page, /href="\/dashboard\/research\/new"/);
});

test("使い方画面の市場分析開始は履歴を経由せず新規入力へ進む", async () => {
  const guide = await source("../src/app/dashboard/monitor/guide/page.tsx");
  const researchStep = guide.slice(
    guide.indexOf('title: "市場分析"'),
    guide.indexOf('title: "AI企画提案"'),
  );
  assert.match(researchStep, /href: "\/dashboard\/research\/new"/);
});

test("認証済みモニターの添付は認可後に管理Storage経由で保存する", async () => {
  const action = await source("../src/app/dashboard/monitor/actions.ts");
  const authorizeAt = action.indexOf("requireCloudGeneralMonitor(profile.id)");
  const adminStorageAt = action.indexOf('createAdminClient().storage.from("monitor-feedback")');
  const uploadAt = action.indexOf("storage.upload(");
  assert.ok(authorizeAt > -1 && adminStorageAt > authorizeAt && uploadAt > adminStorageAt);
  assert.doesNotMatch(action, /supabase\.storage\.from\("monitor-feedback"\)\.upload/);
});

test("AI利用回数はProvider成功前に消費せず上限は事前確認する", async () => {
  const action = await source("../src/app/dashboard/research/actions.ts");
  const requireAt = action.indexOf("requireCloudGeneralMonitor(profile.id)");
  const limitAt = action.indexOf("enrollment.ai_requests_used >= enrollment.ai_request_limit");
  const analyzeAt = action.indexOf("runCloudResearchAiAnalysis({");
  const consumeAt = action.indexOf('consumeCloudGeneralMonitorAiRequest(profile.id, "research")');
  assert.ok(requireAt > -1 && limitAt > requireAt && analyzeAt > limitAt && consumeAt > analyzeAt);
});
