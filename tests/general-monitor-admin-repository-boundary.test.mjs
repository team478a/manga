import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const presentationPaths = [
  "src/app/admin/general-monitors/actions.ts",
  "src/app/admin/general-monitors/page.tsx",
  "src/app/admin/general-monitors/email/page.tsx",
  "src/app/admin/general-monitors/export/route.ts",
  "src/app/admin/users/[id]/general-monitor-actions.ts",
];

test("general monitor presentation authenticates before repository access", async () => {
  for (const path of presentationPaths) {
    const source = await read(path);
    assert.match(source, /requireAdmin/, path);
    assert.doesNotMatch(source, /createAdminClient|@\/lib\/supabase\/admin/, path);
    assert.match(source, /admin-monitor-repository/, path);
  }
  const reviewAction = await read(presentationPaths[0]);
  assert.ok(
    reviewAction.indexOf("await requireAdmin()") <
      reviewAction.indexOf("reviewGeneralMonitorFeedback("),
  );
  const inviteActions = await read(presentationPaths[4]);
  assert.ok(
    inviteActions.indexOf("await requireAdmin()") <
      inviteActions.indexOf("activateGeneralMonitor("),
  );
});

test("general monitor repository preserves queries, actor IDs, and RPC names", async () => {
  const repository = await read(
    "src/modules/general-monitor/infrastructure/admin-monitor-repository.ts",
  );
  for (const contract of [
    "cloud_general_monitor_enrollments",
    "cloud_general_monitor_feedback",
    "cloud_general_monitor_email_audit_logs",
    "monitor-feedback",
    "review_cloud_general_monitor_feedback",
    "activate_cloud_general_monitor",
    "record_cloud_general_monitor_invite_email_sent",
    "stop_cloud_general_monitor",
    "p_actor_profile_id",
    "p_target_profile_id",
  ]) assert.match(repository, new RegExp(contract));
  assert.match(repository, /\.eq\("profile_id", profileId\)/);
  assert.match(repository, /createSignedUrl\(path, 600\)/);
});
