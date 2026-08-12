import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Worker route enters through the Cloud AI application boundary", () => {
  const route = read("src/app/api/internal/cloud-ai/worker/route.ts");
  const processGeneration = read(
    "src/modules/cloud-ai/application/process-generation.ts",
  );

  assert.match(route, /@\/modules\/cloud-ai\/application\/process-generation/);
  assert.doesNotMatch(route, /@\/lib\/cloud-ai-worker["']/);
  assert.match(processGeneration, /infrastructure\/generated-asset-storage\.ts/);
  assert.match(processGeneration, /infrastructure\/cloud-ai-repository\.ts/);
});

test("Worker lifecycle policies are separated from the legacy orchestrator", () => {
  const worker = read("src/modules/cloud-ai/application/process-generation.ts");
  const claim = read("src/modules/cloud-ai/application/claim-next-job.ts");
  const lease = read("src/modules/cloud-ai/application/lease-heartbeat.ts");
  const errors = read("src/modules/cloud-ai/domain/cloud-ai-errors.ts");
  const retry = read("src/modules/cloud-ai/domain/retry-policy.ts");

  assert.match(worker, /claimNextCloudGenerationJob/);
  assert.match(worker, /createCloudJobLeaseHeartbeat/);
  assert.match(worker, /classifyCloudAiWorkerError/);
  assert.match(worker, /shouldRetryGeneration/);
  assert.match(claim, /claimCloudGenerationJob/);
  assert.match(lease, /extend_cloud_generation_job_lease/);
  assert.match(errors, /CloudGenerationLeaseLostError/);
  assert.match(retry, /shouldRetryCloudGeneration/);
});

test("Domain policy does not access Supabase, RPC, Storage, or providers", () => {
  const domainFiles = [
    "src/modules/cloud-ai/domain/cloud-ai-errors.ts",
    "src/modules/cloud-ai/domain/generation-job.ts",
    "src/modules/cloud-ai/domain/retry-policy.ts",
  ];
  for (const path of domainFiles) {
    const source = read(path);
    assert.doesNotMatch(source, /createAdminClient|\.rpc\(|\.storage\.|provider_id.*=/);
  }
});

test("Legacy worker health import remains compatible", () => {
  const compatibilityFile = read("src/lib/cloud-ai-worker-health.ts");
  assert.match(
    compatibilityFile,
    /modules\/cloud-ai\/application\/inspect-worker-health\.ts/,
  );
});

test("Worker route, Storage, Gateway, and admin compatibility seams are complete", () => {
  const appRoute = read("src/app/api/internal/cloud-ai/worker/route.ts");
  const storage = read(
    "src/modules/cloud-ai/infrastructure/generated-asset-storage.ts",
  );
  const gateway = read("src/modules/cloud-ai/infrastructure/gateway-provider.ts");
  const legacyWorker = read("src/lib/cloud-ai-worker.ts");
  const legacyGateway = read("src/lib/cloud-ai-gateway-provider.ts");
  const legacyAdmin = read("src/lib/cloud-ai-worker-admin.ts");

  assert.match(appRoute, /application\/process-generation/);
  assert.match(appRoute, /maxDuration = 240/);
  assert.match(storage, /sanitizeCloudGeneratedImage/);
  assert.match(storage, /record_cloud_generation_storage_cleanup/);
  assert.match(gateway, /cloudModerationResultSchema/);
  assert.match(legacyWorker, /modules\/cloud-ai\/application\/process-generation/);
  assert.match(legacyGateway, /modules\/cloud-ai\/infrastructure\/gateway-provider/);
  assert.match(legacyAdmin, /modules\/cloud-ai\/presentation\/admin-actions/);
});
