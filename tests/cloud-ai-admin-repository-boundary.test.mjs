import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const actionContracts = [
  ["runCloudAiWorkerOnceAction", "recordCloudAiAdminAudit("],
  ["cancelCloudAiJobAction", "loadCloudAiJobForCancel("],
  ["updateCloudAiSettingsAction", "updateCloudAiAdminSettings("],
  ["updateCloudAiPlanAction", "updateCloudAiAdminPlan("],
  ["createCloudAiPriceAction", "createCloudAiAdminPrice("],
  ["setCloudAiPriceActiveAction", "setCloudAiAdminPriceActive("],
];

test("cloud AI admin presentation authenticates before repository access", async () => {
  const [page, actions] = await Promise.all([
    read("src/app/admin/cloud-ai/page.tsx"),
    read("src/app/admin/cloud-ai/actions.ts"),
  ]);
  for (const [path, source] of [
    ["page", page],
    ["actions", actions],
  ]) {
    assert.match(source, /admin-cloud-ai-repository/, path);
    assert.doesNotMatch(
      source,
      /createAdminClient|@\/lib\/supabase\/admin|createClient\(\)/,
      path,
    );
  }
  const pageStart = page.indexOf("export default async function");
  assert.ok(
    page.indexOf("await requireAdmin()", pageStart) <
      page.indexOf("loadCloudAiAdminWorkspace(", pageStart),
  );
  for (const [exportName, repositoryCall] of actionContracts) {
    const start = actions.indexOf(`export async function ${exportName}`);
    const next = actions.indexOf("export async function", start + 1);
    const source = actions.slice(start, next === -1 ? undefined : next);
    assert.ok(start >= 0, exportName);
    assert.ok(
      source.indexOf("await requireAdmin()") < source.indexOf(repositoryCall),
      exportName,
    );
  }
});

test("cloud AI admin repository preserves DB, RPC, and audit contracts", async () => {
  const repository = await read(
    "src/modules/cloud-ai/infrastructure/admin-cloud-ai-repository.ts",
  );
  for (const contract of [
    "cloud_ai_settings",
    "cloud_ai_plans",
    "cloud_ai_provider_prices",
    "cloud_ai_daily_costs",
    "cloud_generation_jobs",
    "cloud_ai_admin_audit_logs",
    "cloud_ai_notifications",
    'limit(50)',
    'limit(14)',
    'limit(20)',
    'cancel_cloud_generation_job',
    'p_job_id: jobId',
    'new DomainError(',
  ]) {
    assert.ok(repository.includes(contract), contract);
  }
  assert.match(repository, /\.in\("status", \["queued", "failed", "running"\]\)/);
  assert.match(repository, /\.gte\("updated_at", input\.failedSince\)/);
  assert.match(repository, /\.lt\("lease_expires_at", input\.checkedAt\)/);
  assert.match(repository, /actor_profile_id: input\.actorId/);
  assert.match(repository, /before_value: input\.before/);
  assert.match(repository, /after_value: input\.after/);
});

test("cloud AI admin repository does not invoke providers or expose Worker secrets", async () => {
  const repository = await read(
    "src/modules/cloud-ai/infrastructure/admin-cloud-ai-repository.ts",
  );
  assert.doesNotMatch(
    repository,
    /MANGAI_CLOUD_AI_WORKER_SECRET|authorization|Bearer|AbortSignal|provider.*generate/iu,
  );
});
