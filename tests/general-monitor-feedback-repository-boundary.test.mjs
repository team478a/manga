import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("monitor feedback action authenticates and authorizes before repository access", async () => {
  const action = await read("src/app/dashboard/monitor/actions.ts");
  const start = action.indexOf(
    "export async function submitCloudGeneralMonitorFeedbackAction",
  );

  assert.match(action, /monitor-feedback-repository/);
  assert.doesNotMatch(action, /createAdminClient|@\/lib\/supabase\/admin/);
  assert.ok(start >= 0);
  assert.ok(
    action.indexOf("await requireProfile()", start) <
      action.indexOf("await requireCloudGeneralMonitor(profile.id)", start),
  );
  assert.ok(
    action.indexOf("await requireCloudGeneralMonitor(profile.id)", start) <
      action.indexOf("saveGeneralMonitorFeedback({", start),
  );
});

test("monitor feedback repository preserves private Storage and rollback contracts", async () => {
  const repository = await read(
    "src/modules/general-monitor/infrastructure/monitor-feedback-repository.ts",
  );

  assert.match(repository, /createAdminClient\(\)/);
  assert.match(repository, /admin\.storage\.from\("monitor-feedback"\)/);
  assert.match(
    repository,
    /`\$\{input\.ownerProfileId\}\/\$\{input\.feedbackId\}\.\$\{input\.screenshot\.extension\}`/,
  );
  assert.match(repository, /contentType: input\.screenshot\.file\.type/);
  assert.match(repository, /upsert: false/);
  assert.match(repository, /\.remove\(\[attachmentPath\]\)/);
});

test("monitor feedback repository preserves DB owner and payload contracts", async () => {
  const repository = await read(
    "src/modules/general-monitor/infrastructure/monitor-feedback-repository.ts",
  );

  assert.match(repository, /\.from\("cloud_general_monitor_feedback"\)\.insert/);
  assert.match(repository, /owner_profile_id: input\.ownerProfileId/);
  for (const field of [
    "request_type",
    "workflow_step",
    "page_url",
    "client_context",
    "attachment_path",
  ]) {
    assert.match(repository, new RegExp(`${field}:`));
  }
});
