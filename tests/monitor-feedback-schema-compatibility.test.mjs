import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  isMissingMonitorFeedbackSchema,
  legacyMonitorFeedbackComment,
  legacyQualityFeedbackComment,
} from "../src/modules/general-monitor/infrastructure/monitor-feedback-schema-compatibility.ts";

test("PostgRESTとPostgresの列不足だけを互換保存対象にする", () => {
  assert.equal(isMissingMonitorFeedbackSchema({ code: "PGRST204" }), true);
  assert.equal(isMissingMonitorFeedbackSchema({ code: "42703" }), true);
  assert.equal(
    isMissingMonitorFeedbackSchema({ message: "column request_type does not exist" }),
    true,
  );
  assert.equal(isMissingMonitorFeedbackSchema({ code: "42501", message: "RLS" }), false);
  assert.equal(isMissingMonitorFeedbackSchema({ code: "23514", message: "check" }), false);
});

test("旧schemaでも報告の種類・件名・影響度と品質対象を本文へ退避する", () => {
  const report = legacyMonitorFeedbackComment({
    requestType: "bug",
    title: "保存できない",
    severity: "blocked",
    comment: "再試行しても失敗します。",
    attachmentOmitted: true,
  });
  assert.match(report, /bug\/blocked/);
  assert.match(report, /保存できない/);
  assert.match(report, /添付画像は保存されませんでした/);

  const quality = legacyQualityFeedbackComment({
    verdict: "needs_revision",
    issueType: "face",
    severity: "major",
    pageNumber: 3,
    panelName: "コマ2",
    comment: "表情を修正したい。",
  });
  assert.match(quality, /3ページ\/コマ2/);
  assert.match(quality, /needs_revision\/face\/major/);
});

test("利用者履歴と管理画面は列不足時だけ基本列へfallbackする", async () => {
  const [monitorPage, adminRepository] = await Promise.all([
    readFile(new URL("../src/app/dashboard/monitor/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/general-monitor/infrastructure/admin-monitor-repository.ts", import.meta.url), "utf8"),
  ]);
  assert.match(monitorPage, /isMissingMonitorFeedbackSchema/);
  assert.match(monitorPage, /id,workflow_step,rating,outcome,comment,created_at/);
  assert.match(adminRepository, /isMissingMonitorFeedbackSchema/);
  assert.match(adminRepository, /id,owner_profile_id,workflow_step,rating,outcome,comment,created_at/);
});
