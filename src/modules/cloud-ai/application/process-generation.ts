import {
  AIProviderError,
  cloudGenerationInputSchema,
  type CloudImageGenerationProvider,
  type CloudTextGenerationProvider,
} from "@mangai/ai-core";
import { CLOUD_ASSET_BUCKET } from "../../../lib/cloud-creator-contract.ts";
import { createAdminClient } from "../../../lib/supabase/admin.ts";
import { claimNextCloudGenerationJob } from "./claim-next-job.ts";
import { createCloudJobLeaseHeartbeat } from "./lease-heartbeat.ts";
import {
  CloudGenerationLeaseLostError,
  classifyCloudAiWorkerError,
} from "../domain/cloud-ai-errors.ts";
import type {
  ClaimedCloudGenerationJob,
  UploadedCloudGeneratedAsset,
} from "../domain/generation-job.ts";
import { shouldRetryGeneration } from "../domain/retry-policy.ts";
import {
  compensateUploadedAsset,
  processPendingCloudStorageCleanup,
  readCloudGenerationJobState,
  uploadGeneratedAsset,
} from "../infrastructure/generated-asset-storage.ts";
import {
  checkpointCloudGenerationProviderJob,
  completeCloudGenerationJob,
  deferCloudGenerationProviderJob,
  failCloudGenerationJob,
} from "../infrastructure/cloud-ai-repository.ts";
import { evaluateCompletedPanelCandidate } from "../../manga-quality/application/evaluate-completed-panel.ts";
import { adoptCompletedPanelCandidate } from "../../manga/application/auto-adopt-completed-panel.ts";
import { createAutomaticPanelAdoptionRepository } from "../../manga/infrastructure/auto-panel-adoption-repository.ts";
import { placeCompletedPageDialogue } from "../../manga/application/auto-place-page-dialogue.ts";
import { createPageDialoguePlacementRepository } from "../../manga/infrastructure/dialogue-placement-repository.ts";

export { createCloudJobLeaseHeartbeat } from "./lease-heartbeat.ts";
export { CloudGenerationLeaseLostError } from "../domain/cloud-ai-errors.ts";

type AdminClient = ReturnType<typeof createAdminClient>;
type CloudProvider = CloudImageGenerationProvider | CloudTextGenerationProvider;

const MAX_PROVIDER_POLLING_AGE_MS = 30 * 60 * 1_000;

function canContinueProviderPolling(job: ClaimedCloudGenerationJob) {
  const startedAt = Date.parse(job.started_at ?? "");
  if (!Number.isFinite(startedAt)) return false;
  const elapsed = Date.now() - startedAt;
  return elapsed >= 0 && elapsed < MAX_PROVIDER_POLLING_AGE_MS;
}

export { processPendingCloudStorageCleanup };

export async function processPendingCloudPanelAdoption(input: {
  client?: AdminClient;
} = {}) {
  const client = input.client ?? createAdminClient();
  const repository = createAutomaticPanelAdoptionRepository(client);
  try {
    const jobId = await repository.findPendingJobId();
    if (!jobId) return { status: "idle" as const };
    const result = await adoptCompletedPanelCandidate({ jobId, repository });
    return { ...result, jobId };
  } catch {
    return { status: "placement_failed" as const };
  }
}

export async function processPendingCloudDialoguePlacement(input: {
  client?: AdminClient;
} = {}) {
  const client = input.client ?? createAdminClient();
  const repository = createPageDialoguePlacementRepository(client);
  try {
    const jobId = await repository.findPendingJobId();
    if (!jobId) return { status: "idle" as const };
    const result = await placeCompletedPageDialogue({ jobId, repository });
    return { ...result, jobId };
  } catch {
    return { status: "placement_failed" as const };
  }
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
  const job = await claimNextCloudGenerationJob({
    client,
    workerId: input.workerId,
    leaseSeconds: input.leaseSeconds,
  });
  if (!job) return { status: "idle" as const };
  const leaseSeconds = input.leaseSeconds ?? 300;
  const heartbeat = createCloudJobLeaseHeartbeat({
    client,
    job,
    leaseSeconds,
    intervalMs: input.heartbeatIntervalMs,
    toleratedFailures: input.heartbeatToleratedFailures,
  });
  let uploadedAsset: UploadedCloudGeneratedAsset | null = null;
  let checkpointedProviderJobId = job.provider_job_id;
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
      providerJobId: job.provider_job_id ?? undefined,
      checkpointProviderJobId: async (providerJobId: string) => {
        checkpointedProviderJobId = providerJobId;
        await checkpointCloudGenerationProviderJob({
          client,
          job,
          providerJobId,
        });
      },
      referenceImageUrls: [] as string[],
      maskImageUrl: undefined as string | undefined,
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
    if (generation.kind === "image" && generation.maskAssetId) {
      const { data: maskAsset, error: maskError } = await client
        .from("cloud_assets")
        .select("storage_path")
        .eq("id", generation.maskAssetId)
        .eq("project_id", job.project_id)
        .eq("owner_profile_id", job.created_by_profile_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (maskError || !maskAsset?.storage_path)
        throw new AIProviderError(
          "provider_rejected",
          "修正範囲を確認できませんでした。",
          false,
        );
      const { data: signedMask, error: signedMaskError } = await client.storage
        .from(CLOUD_ASSET_BUCKET)
        .createSignedUrl(maskAsset.storage_path, 600);
      if (signedMaskError || !signedMask?.signedUrl)
        throw new AIProviderError(
          "provider_rejected",
          "修正範囲を準備できませんでした。",
          false,
        );
      context.maskImageUrl = signedMask.signedUrl;
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
      uploadedAsset = await uploadGeneratedAsset(
        client,
        job,
        result.images[0],
        generation.outputAlphaMode,
      );
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
    await completeCloudGenerationJob({
      client,
      job,
      uploadedAsset,
      output,
      outputAssetId,
      providerJobId,
      actualCostMicros,
    });
    if (generation.kind === "image") {
      try {
        await evaluateCompletedPanelCandidate({
          client,
          generationJobId: job.id,
          assetAvailable: Boolean(outputAssetId),
          expectedWidth: generation.width,
          expectedHeight: generation.height,
          actualWidth: uploadedAsset?.width,
          actualHeight: uploadedAsset?.height,
        });
      } catch {
        // Evaluation is best-effort and must not turn a completed job into a retry.
      }
      try {
        await adoptCompletedPanelCandidate({
          jobId: job.id,
          repository: createAutomaticPanelAdoptionRepository(client),
        });
      } catch {
        // A later worker run reconciles completed jobs whose placement was interrupted.
      }
      try {
        await placeCompletedPageDialogue({
          jobId: job.id,
          repository: createPageDialoguePlacementRepository(client),
        });
      } catch {
        // Dialogue is reconciled after every page image has been placed.
      }
    }
    return { status: "completed" as const, jobId: job.id, outputAssetId };
  } catch (error) {
    if (uploadedAsset) {
      const state = await readCloudGenerationJobState(client, job.id);
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
    const failure = classifyCloudAiWorkerError(error);
    if (
      failure.code === "timeout" &&
      checkpointedProviderJobId &&
      canContinueProviderPolling(job)
    ) {
      await deferCloudGenerationProviderJob({
        client,
        job,
        providerJobId: checkpointedProviderJobId,
      });
      return { status: "retrying" as const, jobId: job.id };
    }
    const retryable =
      failure.retryable &&
      shouldRetryGeneration({
        attempt: job.attempt_count,
        maxAttempts: job.max_attempts,
        errorCode: failure.code,
      });
    await failCloudGenerationJob({
      client,
      job,
      errorCode: failure.code,
      errorMessage: failure.message,
      retryable,
      providerJobId: checkpointedProviderJobId,
    });
    return {
      status: retryable ? ("retrying" as const) : ("failed" as const),
      jobId: job.id,
    };
  } finally {
    await heartbeat.stop();
  }
}
