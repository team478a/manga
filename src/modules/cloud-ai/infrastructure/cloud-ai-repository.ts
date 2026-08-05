import { DomainError } from "../../../lib/domain-errors.ts";
import { createAdminClient } from "../../../lib/supabase/admin.ts";
import type { ClaimedCloudGenerationJob } from "../domain/generation-job.ts";

export type CloudAiAdminClient = ReturnType<typeof createAdminClient>;

export async function claimCloudGenerationJob(input: {
  client: CloudAiAdminClient;
  workerId: string;
  leaseSeconds: number;
}) {
  const { data, error } = await input.client.rpc("claim_cloud_generation_job", {
    p_worker_id: input.workerId,
    p_lease_seconds: input.leaseSeconds,
  });
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "Cloud AI Jobを取得できませんでした。",
      { cause: error },
    );
  return data?.[0] as ClaimedCloudGenerationJob | undefined;
}
