import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const presentationPaths = [
  "src/app/admin/monitor-issues/actions.ts",
  "src/app/admin/monitor-issues/page.tsx",
];

test("monitor issue presentation authenticates before repository access", async () => {
  for (const path of presentationPaths) {
    const source = await read(path);
    assert.match(source, /requireAdmin/, path);
    assert.doesNotMatch(source, /createAdminClient|@\/lib\/supabase\/admin/, path);
    assert.match(source, /admin-monitor-issue-repository/, path);
  }
  const [actions, page] = await Promise.all(
    presentationPaths.map((path) => read(path)),
  );
  assert.ok(
    actions.indexOf("await requireAdmin()") <
      actions.indexOf("updateAdminMonitorIssueTask("),
  );
  assert.ok(
    page.indexOf("await requireAdmin()") <
      page.lastIndexOf("loadAdminMonitorIssueWorkspace"),
  );
});

test("monitor issue repository preserves query, update, and attachment contracts", async () => {
  const repository = await read(
    "src/modules/monitor-operations/infrastructure/admin-monitor-issue-repository.ts",
  );
  for (const contract of [
    "cloud_monitor_issue_tasks",
    "cloud_general_monitor_feedback",
    "last_reported_at",
    "monitor-feedback",
    "claimed_by",
    "claimed_at",
    "last_error",
  ]) assert.match(repository, new RegExp(contract));
  assert.match(repository, /\.limit\(100\)/);
  assert.match(repository, /\.in\("id", feedbackIds\)/);
  assert.match(repository, /createSignedUrl\(path, 600\)/);
  assert.match(repository, /\.eq\("id", input\.taskId\)/);
});

test("monitor worker remains an authenticated composition root", async () => {
  const worker = await read("src/app/api/internal/monitor-ops/worker/route.ts");
  assert.match(worker, /MANGAI_MONITOR_OPS_WORKER_SECRET/);
  assert.match(worker, /createAdminClient/);
  assert.doesNotMatch(worker, /admin-monitor-issue-repository/);
});
