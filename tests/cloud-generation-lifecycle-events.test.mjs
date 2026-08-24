import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildCloudGenerationLifecycleMutation, classifyCloudGenerationFailureStage, readSafeHttpStatus } from "../src/modules/cloud-ai/domain/generation-lifecycle-event.ts";

test("lifecycle mutation stores only bounded structured fields", () => {
  const mutation = buildCloudGenerationLifecycleMutation({ executionPhase: "failed", eventType: "retry_scheduled", attemptNumber: 120, failureStage: "provider", retryDisposition: "automatic", httpStatus: 503, occurredAt: "2026-08-24T00:00:00.000Z" });
  assert.deepEqual(mutation.event.metadata, {});
  assert.equal(mutation.event.attempt_number, 100);
  assert.equal(mutation.jobUpdate.http_status, 503);
  assert.equal(mutation.jobUpdate.failure_stage, "provider");
});

test("unsafe HTTP values are discarded and failure stages are deterministic", () => {
  assert.equal(readSafeHttpStatus({ status: 429 }), 429);
  assert.equal(readSafeHttpStatus({ statusCode: 503 }), 503);
  assert.equal(readSafeHttpStatus({ status: 99 }), null);
  assert.equal(readSafeHttpStatus({ status: "503" }), null);
  assert.equal(classifyCloudGenerationFailureStage("provider_rejected"), "provider");
  assert.equal(classifyCloudGenerationFailureStage("cloud_generation_lease_invalid"), "lease");
  assert.equal(classifyCloudGenerationFailureStage("asset_not_found"), "reference_resolution");
});

test("Worker lifecycle is flag-gated and never stores provider payload metadata", () => {
  const repository = fs.readFileSync(new URL("../src/modules/cloud-ai/infrastructure/generation-lifecycle-repository.ts", import.meta.url), "utf8");
  const worker = fs.readFileSync(new URL("../src/modules/cloud-ai/application/process-generation.ts", import.meta.url), "utf8");
  assert.match(repository, /featureFlagEnabled\("CLOUD_GENERATION_RESUMABLE_V2_ENABLED"\)/);
  for (const phase of ["preparing", "generating", "validating", "succeeded"])
    assert.match(worker, new RegExp(`executionPhase: "${phase}"`));
  assert.match(worker, /Observability must never repeat a billable provider operation/);
  assert.doesNotMatch(repository, /prompt|signedUrl|authorization|responseBody/i);
});

test("manual retry lineage is owner-checked and compensates an unlinked retry", () => {
  const migration = fs.readFileSync(new URL("../supabase/migrations/202608240003_cloud_generation_retry_lineage.sql", import.meta.url), "utf8");
  const service = fs.readFileSync(new URL("../src/modules/cloud-creator/generation/interactive-retry-service.ts", import.meta.url), "utf8");
  assert.match(migration, /created_by_profile_id=v_profile/i);
  assert.match(migration, /v_source\.status<>'failed'/i);
  assert.match(migration, /v_retry\.status<>'queued'/i);
  assert.match(migration, /parent_job_id=v_source\.id,root_job_id=v_root/i);
  assert.match(service, /link_cloud_generation_retry/);
  assert.match(service, /cancel_cloud_generation_job/);
});
