import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  initialExecutionPhaseForLegacyStatus,
  toResumableCloudGenerationState,
} from "../src/modules/cloud-ai/domain/resumable-generation-state.ts";
import { featureFlagEnabled } from "../src/lib/feature-flags.ts";

test("legacy status backfill never guesses the phase of an active job", () => {
  assert.equal(initialExecutionPhaseForLegacyStatus("queued"), "queued");
  assert.equal(initialExecutionPhaseForLegacyStatus("running"), "unknown");
  assert.equal(initialExecutionPhaseForLegacyStatus("completed"), "succeeded");
  assert.equal(initialExecutionPhaseForLegacyStatus("failed"), "failed");
  assert.equal(initialExecutionPhaseForLegacyStatus("canceled"), "canceled");
});

test("resumable state preserves the existing five-status public contract", () => {
  assert.equal(toResumableCloudGenerationState({ status: "queued" }), "QUEUED");
  assert.equal(
    toResumableCloudGenerationState({
      status: "queued",
      retryDisposition: "automatic",
    }),
    "FAILED_RETRYABLE",
  );
  assert.equal(
    toResumableCloudGenerationState({
      status: "running",
      executionPhase: "preparing",
    }),
    "PREPARING",
  );
  assert.equal(
    toResumableCloudGenerationState({
      status: "running",
      executionPhase: "generating",
    }),
    "GENERATING",
  );
  assert.equal(
    toResumableCloudGenerationState({
      status: "running",
      executionPhase: "validating",
    }),
    "VALIDATING",
  );
  assert.equal(
    toResumableCloudGenerationState({ status: "completed" }),
    "SUCCEEDED",
  );
  assert.equal(
    toResumableCloudGenerationState({
      status: "failed",
      retryDisposition: "manual",
    }),
    "FAILED_RETRYABLE",
  );
  assert.equal(
    toResumableCloudGenerationState({ status: "failed" }),
    "FAILED_FINAL",
  );
  assert.equal(
    toResumableCloudGenerationState({ status: "canceled" }),
    "CANCELLED",
  );
});

test("resumable generation flag is strict and disabled by default", () => {
  assert.equal(featureFlagEnabled("CLOUD_GENERATION_RESUMABLE_V2_ENABLED", {}), false);
  assert.equal(
    featureFlagEnabled("CLOUD_GENERATION_RESUMABLE_V2_ENABLED", {
      CLOUD_GENERATION_RESUMABLE_V2_ENABLED: "true",
    }),
    true,
  );
  assert.equal(
    featureFlagEnabled("CLOUD_GENERATION_RESUMABLE_V2_ENABLED", {
      CLOUD_GENERATION_RESUMABLE_V2_ENABLED: "TRUE",
    }),
    false,
  );
});

test("P0-A migration is additive, secret-safe, and rollback guarded", () => {
  const forward = fs.readFileSync(
    new URL(
      "../supabase/migrations/202608240002_cloud_generation_resumable_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const rollback = fs.readFileSync(
    new URL(
      "../supabase/rollbacks/202608240002_cloud_generation_resumable_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(forward, /add column if not exists execution_phase text/i);
  assert.match(forward, /create table if not exists public\.cloud_generation_job_events/i);
  assert.match(forward, /and not metadata \?\| array\[/i);
  assert.match(forward, /owner_profile_id=public\.current_profile_id\(\)/i);
  assert.match(forward, /grant select,insert on public\.cloud_generation_job_events to service_role/i);
  assert.doesNotMatch(forward, /grant insert[^;]*to authenticated/i);
  assert.match(rollback, /cloud_generation_resumable_foundation_rollback_blocked/i);
});
