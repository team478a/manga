import crypto from "node:crypto";
import {
  AIProviderError,
  cloudGenerationInputSchema,
  shouldRetryCloudGeneration,
  type CloudImageGenerationProvider,
  type CloudTextGenerationProvider,
} from "@mangai/ai-core";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CLOUD_ASSET_BUCKET,
  cloudAssetStoragePath,
  sanitizeCloudGeneratedImage,
} from "@/lib/cloud-creator-contract";

type AdminClient = ReturnType<typeof createAdminClient>;
type CloudProvider = CloudImageGenerationProvider | CloudTextGenerationProvider;

type ClaimedJob = {
  id: string;
  project_id: string;
  page_id: string | null;
  created_by_profile_id: string;
  kind: "image" | "text";
  provider_id: string;
  model_id: string;
  idempotency_key: string;
  input: unknown;
  attempt_count: number;
  max_attempts: number;
  lease_token: string;
};

function classifyWorkerError(error: unknown) {
  if (error instanceof AIProviderError)
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  if (error instanceof Error && error.name === "AbortError")
    return {
      code: "timeout",
      message: "Providerがタイムアウトしました。",
      retryable: true,
    };
  return {
    code: "provider_error",
    message:
      error instanceof Error ? error.message : "Provider処理に失敗しました。",
    retryable: false,
  };
}

async function jobStillRunning(client: AdminClient, job: ClaimedJob) {
  const { data } = await client
    .from("cloud_generation_jobs")
    .select("status,lease_token")
    .eq("id", job.id)
    .single();
  return data?.status === "running" && data.lease_token === job.lease_token;
}

async function saveGeneratedAsset(
  client: AdminClient,
  job: ClaimedJob,
  image: { bytes: Uint8Array; fileName: string },
) {
  const sanitized = await sanitizeCloudGeneratedImage(image.bytes);
  const assetId = crypto.randomUUID();
  const storagePath = cloudAssetStoragePath({
    profileId: job.created_by_profile_id,
    projectId: job.project_id,
    assetId,
    mimeType: "image/png",
  });
  const { error: uploadError } = await client.storage
    .from(CLOUD_ASSET_BUCKET)
    .upload(storagePath, sanitized.bytes, {
      contentType: "image/png",
      upsert: false,
    });
  if (uploadError)
    throw new Error("生成画像を非公開Storageへ保存できませんでした。");
  const { error: insertError } = await client.from("cloud_assets").insert({
    id: assetId,
    project_id: job.project_id,
    owner_profile_id: job.created_by_profile_id,
    storage_path: storagePath,
    file_name: `AI-${image.fileName}`.slice(0, 255),
    mime_type: "image/png",
    byte_size: sanitized.byteSize,
    width: sanitized.width,
    height: sanitized.height,
    sha256: sanitized.sha256,
  });
  if (insertError) {
    await client.storage.from(CLOUD_ASSET_BUCKET).remove([storagePath]);
    throw new Error("生成画像のAsset情報を保存できませんでした。");
  }
  return assetId;
}

export async function processNextCloudGenerationJob(input: {
  workerId: string;
  providers: CloudProvider[];
  client?: AdminClient;
}) {
  const client = input.client ?? createAdminClient();
  const { data, error } = await client.rpc("claim_cloud_generation_job", {
    p_worker_id: input.workerId,
    p_lease_seconds: 120,
  });
  if (error) throw new Error("Cloud AI Jobを取得できませんでした。");
  const job = data?.[0] as ClaimedJob | undefined;
  if (!job) return { status: "idle" as const };
  try {
    const generation = cloudGenerationInputSchema.parse(job.input);
    const provider = input.providers.find(
      (candidate) =>
        candidate.capability.providerId === job.provider_id &&
        candidate.capability.modelId === job.model_id &&
        candidate.capability.kind === job.kind &&
        candidate.capability.enabled,
    );
    if (!provider)
      throw new AIProviderError(
        "provider_unavailable",
        "Providerは現在利用できません。",
        false,
      );
    const context = {
      jobId: job.id,
      projectId: job.project_id,
      pageId: job.page_id ?? undefined,
      idempotencyKey: job.idempotency_key,
    };
    let output: Record<string, unknown>;
    let outputAssetId: string | null = null;
    let providerJobId: string | null = null;
    let actualCostMicros = 0;
    if (generation.kind === "image" && provider.capability.kind === "image") {
      const result = await (provider as CloudImageGenerationProvider).generate(
        generation as typeof generation & { kind: "image" },
        context,
      );
      if (!result.images.length)
        throw new Error("Providerから画像が返されませんでした。");
      if (!(await jobStillRunning(client, job)))
        return { status: "canceled" as const, jobId: job.id };
      outputAssetId = await saveGeneratedAsset(client, job, result.images[0]);
      providerJobId = result.providerJobId ?? null;
      actualCostMicros = result.usage.actualCostMicros ?? 0;
      output = { kind: "image", assetId: outputAssetId };
    } else if (
      generation.kind === "text" &&
      provider.capability.kind === "text"
    ) {
      const result = await (provider as CloudTextGenerationProvider).generate(
        generation as typeof generation & { kind: "text" },
        context,
      );
      if (!(await jobStillRunning(client, job)))
        return { status: "canceled" as const, jobId: job.id };
      providerJobId = result.providerJobId ?? null;
      actualCostMicros = result.usage.actualCostMicros ?? 0;
      output = {
        kind: "text",
        text: result.text.slice(0, 50_000),
        usage: result.usage,
      };
    } else throw new Error("JobとProviderの種類が一致しません。");
    const { error: finishError } = await client.rpc(
      "finish_cloud_generation_job",
      {
        p_job_id: job.id,
        p_lease_token: job.lease_token,
        p_succeeded: true,
        p_output: output,
        p_output_asset_id: outputAssetId,
        p_provider_job_id: providerJobId,
        p_actual_cost_micros: actualCostMicros,
        p_error_code: null,
        p_error_message: null,
        p_retryable: false,
      },
    );
    if (finishError)
      throw new Error("Cloud AI Jobの完了を記録できませんでした。");
    return { status: "completed" as const, jobId: job.id, outputAssetId };
  } catch (error) {
    const failure = classifyWorkerError(error);
    const retryable =
      failure.retryable &&
      shouldRetryCloudGeneration({
        attempt: job.attempt_count,
        maxAttempts: job.max_attempts,
        errorCode: failure.code,
      });
    await client.rpc("finish_cloud_generation_job", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_succeeded: false,
      p_output: null,
      p_output_asset_id: null,
      p_provider_job_id: null,
      p_actual_cost_micros: null,
      p_error_code: failure.code,
      p_error_message: failure.message,
      p_retryable: retryable,
    });
    return {
      status: retryable ? ("retrying" as const) : ("failed" as const),
      jobId: job.id,
    };
  }
}
