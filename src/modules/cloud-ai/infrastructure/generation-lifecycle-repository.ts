import { featureFlagEnabled } from "../../../lib/feature-flags.ts";
import type { ClaimedCloudGenerationJob } from "../domain/generation-job.ts";
import {
  buildCloudGenerationLifecycleMutation,
  type CloudGenerationFailureStage,
  type CloudGenerationLifecycleEventType,
} from "../domain/generation-lifecycle-event.ts";
import type {
  CloudGenerationExecutionPhase,
  CloudGenerationRetryDisposition,
} from "../domain/resumable-generation-state.ts";
import type { CloudAiAdminClient } from "./cloud-ai-repository.ts";

export async function recordCloudGenerationLifecycle(input: {
  client: CloudAiAdminClient;
  job: ClaimedCloudGenerationJob;
  executionPhase: CloudGenerationExecutionPhase;
  eventType: CloudGenerationLifecycleEventType;
  failureStage?: CloudGenerationFailureStage | null;
  retryDisposition?: CloudGenerationRetryDisposition | null;
  httpStatus?: number | null;
  expectedStatus: "queued" | "running" | "completed" | "failed" | "canceled";
  requireLease?: boolean;
}) {
  if (!featureFlagEnabled("CLOUD_GENERATION_RESUMABLE_V2_ENABLED")) return false;
  const mutation = buildCloudGenerationLifecycleMutation({
    executionPhase: input.executionPhase,
    eventType: input.eventType,
    attemptNumber: input.job.attempt_count,
    failureStage: input.failureStage,
    retryDisposition: input.retryDisposition,
    httpStatus: input.httpStatus,
    occurredAt: new Date().toISOString(),
  });
  let update = input.client
    .from("cloud_generation_jobs")
    .update(mutation.jobUpdate)
    .eq("id", input.job.id)
    .eq("status", input.expectedStatus);
  if (input.requireLease !== false)
    update = update.eq("lease_token", input.job.lease_token);
  const { data, error } = await update.select("id").maybeSingle();
  if (error || !data) return false;
  const { error: eventError } = await input.client
    .from("cloud_generation_job_events")
    .insert({
      ...mutation.event,
      job_id: input.job.id,
      project_id: input.job.project_id,
      owner_profile_id: input.job.created_by_profile_id,
    });
  return !eventError;
}
