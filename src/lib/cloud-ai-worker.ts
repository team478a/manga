import crypto from "node:crypto";
import {
  AIProviderError,
  cloudGenerationInputSchema,
  shouldRetryCloudGeneration,
  type CloudImageGenerationProvider,
  type CloudTextGenerationProvider,
} from "@mangai/ai-core";
import { createAdminClient } from "./supabase/admin.ts";
import {
  CLOUD_ASSET_BUCKET,
  cloudAssetStoragePath,
  sanitizeCloudGeneratedImage,
} from "./cloud-creator-contract.ts";
import {
  DomainError,
  LeaseLostError,
  isDomainError,
} from "./domain-errors.ts";
import { logHubError } from "./hub-logger.ts";

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

type UploadedGeneratedAsset = {
  assetId: string;
  storagePath: string;
  fileName: string;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
};

export class CloudGenerationLeaseLostError extends LeaseLostError {
  constructor() {
    super("Cloud AI Jobのleaseを失いました。");
    this.name = "CloudGenerationLeaseLostError";
  }
}

export function createCloudJobLeaseHeartbeat(input: {
  client: AdminClient;
  job: ClaimedJob;
  leaseSeconds: number;
  intervalMs?: number;
  toleratedFailures?: number;
}) {
  const controller = new AbortController();
  const intervalMs = Math.max(10, input.intervalMs ?? 60_000);
  const toleratedFailures = Math.max(0, input.toleratedFailures ?? 1);
  let consecutiveFailures = 0;
  let lost = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;

  const extend = async () => {
    const { error } = await input.client.rpc(
      "extend_cloud_generation_job_lease",
      {
        p_job_id: input.job.id,
        p_lease_token: input.job.lease_token,
        p_lease_seconds: input.leaseSeconds,
      },
    );
    if (error) throw new CloudGenerationLeaseLostError();
  };
  const schedule = () => {
    if (stopped || lost) return;
    timer = setTimeout(() => {
      inFlight = (async () => {
        try {
          await extend();
          consecutiveFailures = 0;
        } catch {
          consecutiveFailures += 1;
          if (consecutiveFailures > toleratedFailures) {
            lost = true;
            controller.abort();
          }
        } finally {
          inFlight = undefined;
          schedule();
        }
      })();
    }, intervalMs);
  };
  schedule();

  return {
    signal: controller.signal,
    get leaseLost() {
      return lost;
    },
    async assertLease() {
      if (lost) throw new CloudGenerationLeaseLostError();
      try {
        await extend();
        consecutiveFailures = 0;
      } catch {
        lost = true;
        controller.abort();
        throw new CloudGenerationLeaseLostError();
      }
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await inFlight;
    },
  };
}

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
  if (isDomainError(error))
    return {
      code: error.code.toLowerCase(),
      message: error.message,
      retryable:
        error.code === "PROVIDER_TIMEOUT" ||
        error.code === "PROVIDER_UNAVAILABLE" ||
        error.code === "RATE_LIMITED",
    };
  return {
    code: "provider_error",
    message:
      error instanceof Error ? error.message : "Provider処理に失敗しました。",
    retryable: false,
  };
}

async function uploadGeneratedAsset(
  client: AdminClient,
  job: ClaimedJob,
  image: { bytes: Uint8Array; fileName: string },
): Promise<UploadedGeneratedAsset> {
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
  return {
    assetId,
    storagePath,
    fileName: `AI-${image.fileName}`.slice(0, 255),
    byteSize: sanitized.byteSize,
    width: sanitized.width,
    height: sanitized.height,
    sha256: sanitized.sha256,
  };
}

async function readJobState(client: AdminClient, jobId: string) {
  const { data } = await client
    .from("cloud_generation_jobs")
    .select("status,output_asset_id")
    .eq("id", jobId)
    .maybeSingle();
  return data as
    | { status: string; output_asset_id: string | null }
    | null
    | undefined;
}

async function compensateUploadedAsset(
  client: AdminClient,
  job: ClaimedJob,
  asset: UploadedGeneratedAsset,
) {
  const { error: removeError } = await client.storage
    .from(CLOUD_ASSET_BUCKET)
    .remove([asset.storagePath]);
  if (!removeError) return;
  const lastError =
    typeof removeError.message === "string"
      ? removeError.message
      : "Storage cleanup failed";
  const { error: recordError } = await client.rpc(
    "record_cloud_generation_storage_cleanup",
    {
      p_job_id: job.id,
      p_bucket_id: CLOUD_ASSET_BUCKET,
      p_storage_path: asset.storagePath,
      p_reason: "cloud_generation_db_completion_failed",
      p_last_error: lastError,
    },
  );
  logHubError(
    "cloud_generation_storage_cleanup_pending",
    removeError,
    {
      jobId: job.id,
      cleanupRecorded: !recordError,
    },
  );
}

export async function processPendingCloudStorageCleanup(input: {
  client?: AdminClient;
}) {
  const client = input.client ?? createAdminClient();
  const { data: pending, error: readError } = await client
    .from("cloud_generation_storage_cleanup")
    .select("id,job_id,bucket_id,storage_path,attempt_count")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (readError)
    throw new Error("Cloud AI Storage cleanup対象を取得できませんでした。");
  if (!pending) return { status: "idle" as const };
  const { error: removeError } = await client.storage
    .from(pending.bucket_id)
    .remove([pending.storage_path]);
  if (removeError) {
    const { error: updateError } = await client
      .from("cloud_generation_storage_cleanup")
      .update({
        attempt_count: pending.attempt_count + 1,
        last_error: String(removeError.message ?? "Storage cleanup failed").slice(
          0,
          500,
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pending.id);
    if (updateError)
      throw new Error("Cloud AI Storage cleanup失敗を記録できませんでした。");
    return { status: "retrying" as const, cleanupId: pending.id };
  }
  const { error: updateError } = await client
    .from("cloud_generation_storage_cleanup")
    .update({
      status: "resolved",
      last_error: null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", pending.id);
  if (updateError)
    throw new Error("Cloud AI Storage cleanup完了を記録できませんでした。");
  return { status: "resolved" as const, cleanupId: pending.id };
}

export async function processNextCloudGenerationJob(input: {
  workerId: string;
  providers: CloudProvider[];
  client?: AdminClient;
  leaseSeconds?: number;
  heartbeatIntervalMs?: number;
  heartbeatToleratedFailures?: number;
}) {
  const client = input.client ?? createAdminClient();
  const { data, error } = await client.rpc("claim_cloud_generation_job", {
    p_worker_id: input.workerId,
    p_lease_seconds: input.leaseSeconds ?? 300,
  });
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "Cloud AI Jobを取得できませんでした。",
      { cause: error },
    );
  const job = data?.[0] as ClaimedJob | undefined;
  if (!job) return { status: "idle" as const };
  const leaseSeconds = input.leaseSeconds ?? 300;
  const heartbeat = createCloudJobLeaseHeartbeat({
    client,
    job,
    leaseSeconds,
    intervalMs: input.heartbeatIntervalMs,
    toleratedFailures: input.heartbeatToleratedFailures,
  });
  let uploadedAsset: UploadedGeneratedAsset | null = null;
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
      referenceImageUrls: [] as string[],
    };
    if (generation.kind === "image" && generation.referenceAssetIds?.length) {
      const { data: referenceAssets, error: referenceError } = await client
        .from("cloud_assets")
        .select("id,storage_path")
        .eq("project_id", job.project_id)
        .eq("owner_profile_id", job.created_by_profile_id)
        .is("deleted_at", null)
        .in("id", generation.referenceAssetIds);
      if (referenceError || referenceAssets?.length !== generation.referenceAssetIds.length)
        throw new AIProviderError(
          "provider_rejected",
          "参照画像を確認できませんでした。",
          false,
        );
      const byId = new Map(referenceAssets.map((asset) => [asset.id, asset.storage_path]));
      for (const assetId of generation.referenceAssetIds) {
        const storagePath = byId.get(assetId);
        if (!storagePath) continue;
        const { data: signed, error: signedError } = await client.storage
          .from(CLOUD_ASSET_BUCKET)
          .createSignedUrl(storagePath, 600);
        if (signedError || !signed?.signedUrl)
          throw new AIProviderError(
            "provider_rejected",
            "参照画像を準備できませんでした。",
            false,
          );
        context.referenceImageUrls.push(signed.signedUrl);
      }
    }
    let output: Record<string, unknown>;
    let outputAssetId: string | null = null;
    let providerJobId: string | null = null;
    let actualCostMicros = 0;
    if (generation.kind === "image" && provider.capability.kind === "image") {
      const result = await (provider as CloudImageGenerationProvider).generate(
        generation as typeof generation & { kind: "image" },
        context,
        heartbeat.signal,
      );
      if (!result.images.length)
        throw new Error("Providerから画像が返されませんでした。");
      await heartbeat.assertLease();
      uploadedAsset = await uploadGeneratedAsset(client, job, result.images[0]);
      await heartbeat.assertLease();
      outputAssetId = uploadedAsset.assetId;
      providerJobId = result.providerJobId ?? null;
      actualCostMicros = result.usage.actualCostMicros ?? 0;
      output = {
        kind: "image",
        assetId: outputAssetId,
        providerModeration: result.providerModeration,
      };
    } else if (
      generation.kind === "text" &&
      provider.capability.kind === "text"
    ) {
      const result = await (provider as CloudTextGenerationProvider).generate(
        generation as typeof generation & { kind: "text" },
        context,
        heartbeat.signal,
      );
      await heartbeat.assertLease();
      providerJobId = result.providerJobId ?? null;
      actualCostMicros = result.usage.actualCostMicros ?? 0;
      output = {
        kind: "text",
        text: result.text.slice(0, 50_000),
        usage: result.usage,
        providerModeration: result.providerModeration,
      };
    } else throw new Error("JobとProviderの種類が一致しません。");
    await heartbeat.assertLease();
    const { error: finishError } = uploadedAsset
      ? await client.rpc("complete_cloud_generation_image_job", {
          p_job_id: job.id,
          p_lease_token: job.lease_token,
          p_asset_id: uploadedAsset.assetId,
          p_storage_path: uploadedAsset.storagePath,
          p_file_name: uploadedAsset.fileName,
          p_byte_size: uploadedAsset.byteSize,
          p_width: uploadedAsset.width,
          p_height: uploadedAsset.height,
          p_sha256: uploadedAsset.sha256,
          p_output: output,
          p_provider_job_id: providerJobId,
          p_actual_cost_micros: actualCostMicros,
        })
      : await client.rpc("finish_cloud_generation_job", {
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
        });
    if (finishError)
      throw new Error("Cloud AI Jobの完了を記録できませんでした。");
    return { status: "completed" as const, jobId: job.id, outputAssetId };
  } catch (error) {
    if (uploadedAsset) {
      const state = await readJobState(client, job.id);
      if (
        state?.status === "completed" &&
        state.output_asset_id === uploadedAsset.assetId
      )
        return {
          status: "completed" as const,
          jobId: job.id,
          outputAssetId: uploadedAsset.assetId,
        };
      await compensateUploadedAsset(client, job, uploadedAsset);
      if (state?.status === "canceled")
        return { status: "canceled" as const, jobId: job.id };
    }
    if (
      heartbeat.leaseLost ||
      error instanceof CloudGenerationLeaseLostError
    )
      return { status: "lease_lost" as const, jobId: job.id };
    try {
      await heartbeat.assertLease();
    } catch {
      return { status: "lease_lost" as const, jobId: job.id };
    }
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
  } finally {
    await heartbeat.stop();
  }
}
