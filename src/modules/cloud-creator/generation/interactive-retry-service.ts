import crypto from "node:crypto";
import { cloudGenerationInputSchema } from "@mangai/ai-core";
import { consumeCloudGeneralMonitorAiRequest } from "@/lib/cloud-general-monitor";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import {
  buildConservativeGeneralAudienceGenerationRetry,
  buildGeneralAudienceGenerationRetry,
  isConservativeGeneralAudienceGenerationRetry,
  isGeneralAudienceGenerationRetry,
} from "../../manga/domain/general-audience-generation-retry";
import { savePanelSpecification } from "../../manga-quality/infrastructure/panel-quality-repository";
import { cloudCreatorContext } from "../auth-context";
import { enqueueCloudGenerationJob } from "./generation-service";
import { featureFlagEnabled } from "@/lib/feature-flags";

export async function retryFailedInteractiveCloudGenerationJob(jobId: string) {
  const { supabase, profile } = await cloudCreatorContext();
  const source = await supabase
    .from("cloud_generation_jobs")
    .select("id,project_id,page_id,status,input,error_code,provider_job_id")
    .eq("id", jobId)
    .maybeSingle();
  if (source.error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "再実行する画像生成を確認できませんでした。",
      { cause: source.error },
    );
  if (!source.data || source.data.status !== "failed")
    throw new ValidationError("再実行できる失敗Jobが見つかりません。");

  const parsedGeneration = cloudGenerationInputSchema.safeParse(
    source.data.input,
  );
  if (
    !parsedGeneration.success ||
    parsedGeneration.data.kind !== "image" ||
    !parsedGeneration.data.targetPanelId ||
    !source.data.page_id
  )
    throw new ValidationError(
      "元のコマ生成条件を安全に復元できないため、再実行できませんでした。",
    );

  const providerRejected =
    Boolean(source.data.provider_job_id) &&
    (source.data.error_code === "provider_rejected" ||
      source.data.error_code === "provider_moderation_blocked");
  if (
    providerRejected &&
    isConservativeGeneralAudienceGenerationRetry(parsedGeneration.data)
  )
    throw new ValidationError(
      "より穏やかな一般向け再構成でも生成できませんでした。構図や内容を変更して作り直してください。",
    );

  const generation = providerRejected
    ? isGeneralAudienceGenerationRetry(parsedGeneration.data)
      ? buildConservativeGeneralAudienceGenerationRetry(parsedGeneration.data)
      : buildGeneralAudienceGenerationRetry(parsedGeneration.data)
    : parsedGeneration.data;
  const specification = await supabase
    .from("cloud_manga_panel_specifications")
    .select("specification")
    .eq("generation_job_id", jobId)
    .maybeSingle();
  if (specification.error && specification.error.code !== "42P01")
    throw new DomainError(
      "INTERNAL_ERROR",
      "コマの生成条件を確認できませんでした。",
      { cause: specification.error },
    );

  await consumeCloudGeneralMonitorAiRequest(profile.id, "panel_image");
  const newJobId = await enqueueCloudGenerationJob({
    projectId: source.data.project_id,
    pageId: source.data.page_id,
    idempotencyKey: crypto.randomUUID(),
    generation,
  });
  if (featureFlagEnabled("CLOUD_GENERATION_RESUMABLE_V2_ENABLED")) {
    const { error: lineageError } = await supabase.rpc(
      "link_cloud_generation_retry",
      { p_source_job_id: jobId, p_retry_job_id: newJobId },
    );
    if (lineageError) {
      await supabase.rpc("cancel_cloud_generation_job", { p_job_id: newJobId });
      throw new DomainError(
        "INTERNAL_ERROR",
        "再実行履歴を安全に保存できなかったため、生成を開始しませんでした。",
        { cause: lineageError },
      );
    }
  }
  if (specification.data?.specification) {
    try {
      await savePanelSpecification({
        client: supabase,
        generationJobId: newJobId,
        specification: specification.data.specification,
      });
    } catch {
      // Quality telemetry must never cancel an already queued generation.
    }
  }
  return newJobId;
}
