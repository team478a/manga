import { DomainError } from "../../../lib/domain-errors.ts";
import { createAdminClient } from "../../../lib/supabase/admin.ts";
import type {
  ClaimedCloudGenerationJob,
  UploadedCloudGeneratedAsset,
} from "../domain/generation-job.ts";

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

export async function completeCloudGenerationJob(input: {
  client: CloudAiAdminClient;
  job: ClaimedCloudGenerationJob;
  uploadedAsset: UploadedCloudGeneratedAsset | null;
  output: Record<string, unknown>;
  outputAssetId: string | null;
  providerJobId: string | null;
  actualCostMicros: number;
}) {
  const { error } = input.uploadedAsset
    ? await input.client.rpc("complete_cloud_generation_image_job", {
        p_job_id: input.job.id,
        p_lease_token: input.job.lease_token,
        p_asset_id: input.uploadedAsset.assetId,
        p_storage_path: input.uploadedAsset.storagePath,
        p_file_name: input.uploadedAsset.fileName,
        p_byte_size: input.uploadedAsset.byteSize,
        p_width: input.uploadedAsset.width,
        p_height: input.uploadedAsset.height,
        p_sha256: input.uploadedAsset.sha256,
        p_output: input.output,
        p_provider_job_id: input.providerJobId,
        p_actual_cost_micros: input.actualCostMicros,
      })
    : await input.client.rpc("finish_cloud_generation_job", {
        p_job_id: input.job.id,
        p_lease_token: input.job.lease_token,
        p_succeeded: true,
        p_output: input.output,
        p_output_asset_id: input.outputAssetId,
        p_provider_job_id: input.providerJobId,
        p_actual_cost_micros: input.actualCostMicros,
        p_error_code: null,
        p_error_message: null,
        p_retryable: false,
      });
  if (error)
    throw new Error("Cloud AI Jobの完了を記録できませんでした。");
}

export async function failCloudGenerationJob(input: {
  client: CloudAiAdminClient;
  job: ClaimedCloudGenerationJob;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}) {
  await input.client.rpc("finish_cloud_generation_job", {
    p_job_id: input.job.id,
    p_lease_token: input.job.lease_token,
    p_succeeded: false,
    p_output: null,
    p_output_asset_id: null,
    p_provider_job_id: null,
    p_actual_cost_micros: null,
    p_error_code: input.errorCode,
    p_error_message: input.errorMessage,
    p_retryable: input.retryable,
  });
}
