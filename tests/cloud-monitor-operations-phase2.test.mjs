import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseMonitorDiagnostic,
  sanitizeMonitorText,
  sanitizeMonitorUrl,
  validateMonitorScreenshot,
  validateMonitorScreenshots,
} from "../src/lib/monitor-feedback.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("報告本文から個人情報と認証情報を除去する", () => {
  const sanitized = sanitizeMonitorText("me@example.com 090-1234-5678 token=very-secret-token-value Bearer abcdefghijklmnop");
  assert.doesNotMatch(sanitized, /me@example\.com|090-1234-5678|very-secret-token-value|abcdefghijklmnop/);
  assert.match(sanitized, /メールアドレス/);
  assert.match(sanitized, /電話番号/);
  assert.match(sanitized, /非表示/);
  assert.match(sanitized, /認証情報/);
});

test("画面URLはMANGAIのpathnameだけを保存する", () => {
  assert.equal(sanitizeMonitorUrl("/dashboard/research/new?token=secret#panel"), "/dashboard/research/new");
  assert.equal(sanitizeMonitorUrl("https://app.mang-ai.com/dashboard?email=a@example.com"), "https://app.mang-ai.com/dashboard");
  assert.equal(sanitizeMonitorUrl("https://example.com/private"), "");
});

test("ブラウザー診断と画像を制限する", () => {
  const diagnostic = parseMonitorDiagnostic(JSON.stringify({
    userAgent: "test", language: "ja", viewport: { width: 390, height: 844 },
    timezone: "Asia/Tokyo", pathname: "/dashboard/monitor", capturedAt: "2026-08-03T00:00:00.000Z", online: true,
  }));
  assert.equal(diagnostic.viewport?.width, 390);
  assert.deepEqual(parseMonitorDiagnostic("not-json"), {});
  assert.equal(validateMonitorScreenshot(new File([], "empty.png", { type: "image/png" })), null);
  assert.throws(() => validateMonitorScreenshot(new File(["x"], "bad.gif", { type: "image/gif" })), /monitor_screenshot_invalid/);
  assert.equal(validateMonitorScreenshots([
    new File(["1"], "one.png", { type: "image/png" }),
    new File(["2"], "two.webp", { type: "image/webp" }),
  ]).length, 2);
  assert.throws(() => validateMonitorScreenshots(Array.from({ length: 6 }, (_, index) =>
    new File([String(index)], `${index}.jpg`, { type: "image/jpeg" }),
  )), /monitor_screenshots_invalid/);
  assert.throws(() => validateMonitorScreenshots([
    new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.png", {
      type: "image/png",
    }),
  ]), /monitor_screenshots_invalid/);
});

test("非公開添付・投稿制限・状況通知をDBで強制する", async () => {
  const migration = await read("../supabase/migrations/202608030002_cloud_monitor_operations_phase2.sql");
  assert.match(migration, /'monitor-feedback','monitor-feedback',false,5242880/);
  assert.match(migration, /image\/png/);
  assert.match(migration, />=5/);
  assert.match(migration, />=30/);
  assert.match(migration, /monitor_report_received/);
  assert.match(migration, /monitor_report_status/);
  assert.match(migration, /sync_cloud_monitor_issue_public_status/);
  assert.match(migration, /current_profile_id\(\)::text/);
});

test("利用者画面と管理画面は診断・添付・進捗を表示する", async () => {
  const [form, action, feedbackRepository, monitor, admin, monitorRepository, issues, dashboard] = await Promise.all([
    read("../src/app/dashboard/monitor/MonitorFeedbackForm.tsx"),
    read("../src/app/dashboard/monitor/actions.ts"),
    read("../src/modules/general-monitor/infrastructure/monitor-feedback-repository.ts"),
    read("../src/app/dashboard/monitor/page.tsx"),
    read("../src/app/admin/general-monitors/page.tsx"),
    read("../src/modules/general-monitor/infrastructure/admin-monitor-repository.ts"),
    read("../src/app/admin/monitor-issues/page.tsx"),
    read("../src/app/dashboard/page.tsx"),
  ]);
  assert.match(form, /diagnostic/);
  assert.match(form, /スクリーンショット/);
  assert.match(form, /multiple name="screenshots"/);
  assert.match(form, /optimizeMonitorScreenshots/);
  assert.match(form, /合計3MB以下へ自動調整/);
  assert.match(form, /aria-live="assertive"/);
  assert.match(action, /sanitizeMonitorText/);
  assert.match(action, /getAll\("screenshots"\)/);
  assert.match(feedbackRepository, /attachment_paths: attachmentPaths/);
  assert.match(feedbackRepository, /\.remove\(uploadedPaths\)/);
  assert.match(monitor, /publicStatusLabels/);
  assert.match(admin, /attachmentUrls/);
  assert.match(monitorRepository, /createSignedUrl/);
  assert.match(admin, /直近100件内の報告/);
  assert.match(issues, /添付画像\{index \+ 1\}を確認/);
  assert.match(dashboard, /通知 \{notificationsResult\.count/);
});

test("実画像はVercelの送信上限を越える前にブラウザで最適化する", async () => {
  const [client, limits, server] = await Promise.all([
    read("../src/lib/monitor-feedback-client.ts"),
    read("../src/lib/monitor-feedback-limits.ts"),
    read("../src/lib/monitor-feedback.ts"),
  ]);
  assert.match(limits, /MAX_MONITOR_SCREENSHOTS_TRANSPORT_BYTES = 3 \* 1024 \* 1024/);
  assert.match(client, /createImageBitmap/);
  assert.match(client, /URL\.createObjectURL/);
  assert.match(client, /canvas\.toBlob/);
  assert.match(client, /image\/webp/);
  assert.match(client, /transportBytes > MAX_MONITOR_SCREENSHOTS_TRANSPORT_BYTES/);
  assert.match(server, /MAX_MONITOR_SCREENSHOTS_TRANSPORT_BYTES/);
});

test("複数添付migrationは既存1枚を保持し最大5枚へ拡張する", async () => {
  const [migration, rollback] = await Promise.all([
    read("../supabase/migrations/202609150001_cloud_monitor_feedback_multiple_attachments.sql"),
    read("../supabase/rollbacks/202609150001_cloud_monitor_feedback_multiple_attachments.sql"),
  ]);
  assert.match(migration, /add column if not exists attachment_paths text\[\]/);
  assert.match(migration, /set attachment_paths=array\[attachment_path\]/);
  assert.match(migration, /cardinality\(attachment_paths\) between 0 and 5/);
  assert.match(rollback, /set attachment_path=attachment_paths\[1\]/);
  assert.match(rollback, /drop column if exists attachment_paths/);
});

test("rollbackはPhase 2の追加物を除去する", async () => {
  const rollback = await read("../supabase/rollbacks/202608030002_cloud_monitor_operations_phase2.sql");
  assert.match(rollback, /delete from storage\.buckets where id='monitor-feedback'/);
  assert.match(rollback, /drop column if exists client_context/);
  assert.match(rollback, /drop function if exists public\.limit_cloud_monitor_feedback_rate/);
});
