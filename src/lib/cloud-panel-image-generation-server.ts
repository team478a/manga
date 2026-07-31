import { pageCanvasSchema } from "@mangai/canvas-core";
import { cloudCreatorContext } from "@/modules/cloud-creator/auth-context";
import { enqueueCloudGenerationJob } from "@/modules/cloud-creator/generation/generation-service";
import {
  assertGeneralStoryboardProject,
  buildStoryboardPanelGeneration,
  cloudPanelImageGenerationFeatureEnabled,
  cloudPanelImageGenerationRequestSchema,
} from "./cloud-panel-image-generation.ts";
import { cloudStoryboardResultSchema } from "./cloud-storyboard.ts";
import {
  DomainError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "./domain-errors.ts";
import { consumeCloudGeneralMonitorAiRequest } from "./cloud-general-monitor.ts";

export async function enqueueStoryboardPanelImage(input: unknown) {
  if (!cloudPanelImageGenerationFeatureEnabled())
    throw new PermissionDeniedError("ネーム画像生成は現在停止中です。");
  const request = cloudPanelImageGenerationRequestSchema.parse(input);
  const { supabase, profile } = await cloudCreatorContext();

  const { data: materialization, error: materializationError } = await supabase
    .from("cloud_story_storyboard_projects")
    .select("owner_profile_id,storyboard_version_id,project_id")
    .eq("project_id", request.projectId)
    .eq("owner_profile_id", profile.id)
    .maybeSingle();
  if (materializationError)
    throw new DomainError(
      "INTERNAL_ERROR",
      "ネームとの関連を確認できませんでした。",
      { cause: materializationError },
    );
  assertGeneralStoryboardProject({
    materializationFound: Boolean(materialization),
    ownerProfileId: materialization?.owner_profile_id ?? null,
    expectedOwnerProfileId: profile.id,
  });

  const [{ data: page, error: pageError }, storyboardResult] =
    await Promise.all([
      supabase
        .from("cloud_pages")
        .select("id,project_id,page_number,revision")
        .eq("id", request.pageId)
        .eq("project_id", request.projectId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("cloud_story_storyboard_versions")
        .select("owner_profile_id,result")
        .eq("id", materialization!.storyboard_version_id)
        .eq("owner_profile_id", profile.id)
        .maybeSingle(),
    ]);
  if (pageError || storyboardResult.error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "生成元を読み込めませんでした。",
      { cause: pageError ?? storyboardResult.error },
    );
  if (!page || !storyboardResult.data)
    throw new ResourceNotFoundError("生成元のネームが見つかりません。");

  const { data: snapshot, error: snapshotError } = await supabase
    .from("cloud_canvas_snapshots")
    .select("canvas")
    .eq("page_id", page.id)
    .eq("revision", page.revision)
    .maybeSingle();
  if (snapshotError)
    throw new DomainError("INTERNAL_ERROR", "Canvasを読み込めませんでした。", {
      cause: snapshotError,
    });
  if (!snapshot)
    throw new ResourceNotFoundError("Canvasが見つかりません。");

  const resolved = buildStoryboardPanelGeneration({
    storyboard: cloudStoryboardResultSchema.parse(storyboardResult.data.result),
    pageNumber: page.page_number,
    canvas: pageCanvasSchema.parse(snapshot.canvas),
    panelId: request.panelId,
  });
  await consumeCloudGeneralMonitorAiRequest(profile.id, "panel_image");
  const id = await enqueueCloudGenerationJob({
    projectId: request.projectId,
    pageId: request.pageId,
    idempotencyKey: request.idempotencyKey,
    generation: resolved.generation,
  });
  return {
    id,
    panelId: resolved.panelId,
    pageNumber: resolved.pageNumber,
    panelNumber: resolved.panelNumber,
  };
}
