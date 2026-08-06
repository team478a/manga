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
  const source = await readSource("../src/app/dashboard/monitor/actions.ts");
  assert.match(source, /await requireProfile\(\)/);
  assert.match(source, /await requireCloudGeneralMonitor\(profile\.id\)/);
  assert.match(source, /const admin = createAdminClient\(\)/);
  assert.match(
    source,
    /await admin\s*\.from\("cloud_general_monitor_feedback"\)\s*\.insert/,
  );
});
