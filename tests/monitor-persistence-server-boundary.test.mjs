import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("completed research reports persist through the trusted server client", async () => {
  const source = await readSource(
    "../src/modules/research/infrastructure/research-repository.ts",
  );
  const createReport = source.slice(
    source.indexOf("export async function createCloudResearchReport"),
    source.indexOf("export async function listCloudResearchReports"),
  );
  assert.match(createReport, /createAdminClient\(\)/);
  assert.doesNotMatch(createReport, /await createClient\(\)/);
});

test("monitor feedback persists after server-side profile and enrollment checks", async () => {
  const [action, repository] = await Promise.all([
    readSource("../src/app/dashboard/monitor/actions.ts"),
    readSource("../src/modules/general-monitor/infrastructure/monitor-feedback-repository.ts"),
  ]);
  assert.match(action, /await requireProfile\(\)/);
  assert.match(action, /await requireCloudGeneralMonitor\(profile\.id\)/);
  assert.ok(
    action.indexOf("await requireCloudGeneralMonitor(profile.id)") <
      action.indexOf("saveGeneralMonitorFeedback({"),
  );
  assert.match(repository, /const admin = createAdminClient\(\)/);
  assert.match(
    repository,
    /await admin\.from\("cloud_general_monitor_feedback"\)\.insert/,
  );
});
