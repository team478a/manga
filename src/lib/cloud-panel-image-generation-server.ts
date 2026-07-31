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
import { cloudStoryScenarioResultSchema } from "./cloud-scenario.ts";
import {
  DomainError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "./domain-errors.ts";
import { consumeCloudGeneralMonitorAiRequest } from "./cloud-general-monitor.ts";
import type { CloudCharacterProfile } from "./cloud-character-profile.ts";
import type { CloudStyleBible, CloudWorldProfile } from "./cloud-world-bible.ts";

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
        .select("owner_profile_id,scenario_version_id,result")
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

  const storyboard = cloudStoryboardResultSchema.parse(
    storyboardResult.data.result,
  );
  const { data: scenarioVersion } = await supabase
    .from("cloud_story_scenario_versions")
    .select("result")
    .eq("id", storyboardResult.data.scenario_version_id)
    .eq("owner_profile_id", profile.id)
    .maybeSingle();
  const characterProfiles = cloudStoryScenarioResultSchema.safeParse(
    scenarioVersion?.result,
  );
  let visualCharacterProfiles: CloudCharacterProfile[] = [];
  const profileRows = await supabase
    .from("cloud_character_profiles")
    .select("id,project_id,name,role,current_version,updated_at")
    .eq("project_id", request.projectId)
    .eq("owner_profile_id", profile.id)
    .is("deleted_at", null);
  if (profileRows.error && profileRows.error.code !== "42P01")
    throw new DomainError(
      "INTERNAL_ERROR",
      "キャラクター設定を読み込めませんでした。",
      { cause: profileRows.error },
    );
  if (!profileRows.error && (profileRows.data?.length ?? 0) > 0) {
    const versionRows = await supabase
      .from("cloud_character_profile_versions")
      .select(
        "profile_id,version_number,appearance_age,body_build,hair,costume,color_palette,immutable_traits,prompt,negative_prompt",
      )
      .in(
        "profile_id",
        profileRows.data!.map((item) => item.id),
      );
    if (versionRows.error)
      throw new DomainError(
        "INTERNAL_ERROR",
        "キャラクター設定を読み込めませんでした。",
        { cause: versionRows.error },
      );
    visualCharacterProfiles = profileRows.data!.flatMap((profileRow) => {
      const version = versionRows.data?.find(
        (item) =>
          item.profile_id === profileRow.id &&
          item.version_number === profileRow.current_version,
      );
      return version
        ? [{ ...profileRow, ...version } as CloudCharacterProfile]
        : [];
    });
  }
  let styleBible: CloudStyleBible | null = null;
  let worldProfiles: CloudWorldProfile[] = [];
  const [styleRow, worldRows] = await Promise.all([
    supabase.from("cloud_style_bibles")
      .select("id,project_id,current_version,updated_at")
      .eq("project_id", request.projectId).eq("owner_profile_id", profile.id)
      .maybeSingle(),
    supabase.from("cloud_world_profiles")
      .select("id,project_id,kind,name,current_version,updated_at")
      .eq("project_id", request.projectId).eq("owner_profile_id", profile.id)
      .is("deleted_at", null),
  ]);
  const worldBibleUnavailable =
    styleRow.error?.code === "42P01" || worldRows.error?.code === "42P01";
  if (!worldBibleUnavailable && (styleRow.error || worldRows.error))
    throw new DomainError("INTERNAL_ERROR", "画風・世界観設定を読み込めませんでした。", {
      cause: styleRow.error ?? worldRows.error,
    });
  if (!worldBibleUnavailable && styleRow.data) {
    const version = await supabase.from("cloud_style_bible_versions")
      .select("art_style,linework,shading,background_detail,composition_rules,negative_prompt")
      .eq("bible_id", styleRow.data.id)
      .eq("version_number", styleRow.data.current_version).maybeSingle();
    if (version.error) throw new DomainError("INTERNAL_ERROR", "画風設定を読み込めませんでした。", { cause: version.error });
    if (version.data) styleBible = { ...styleRow.data, ...version.data } as CloudStyleBible;
  }
  if (!worldBibleUnavailable && (worldRows.data?.length ?? 0) > 0) {
    const versions = await supabase.from("cloud_world_profile_versions")
      .select("profile_id,version_number,description,visual_traits,color_palette,continuity_rules,prompt,negative_prompt")
      .in("profile_id", worldRows.data!.map((item) => item.id));
    if (versions.error) throw new DomainError("INTERNAL_ERROR", "場所・小物設定を読み込めませんでした。", { cause: versions.error });
    worldProfiles = worldRows.data!.flatMap((profileRow) => {
      const version = versions.data?.find((item) => item.profile_id === profileRow.id && item.version_number === profileRow.current_version);
      return version ? [{ ...profileRow, ...version } as CloudWorldProfile] : [];
    });
  }
  const canvas = pageCanvasSchema.parse(snapshot.canvas);
  const jobs: Array<{ id: string; candidateNumber: number }> = [];
  let resolved: ReturnType<typeof buildStoryboardPanelGeneration> | null = null;
  let partial = false;
  for (let candidateIndex = 0; candidateIndex < request.candidateCount; candidateIndex += 1) {
    try {
      resolved = buildStoryboardPanelGeneration({
        storyboard,
        pageNumber: page.page_number,
        canvas,
        panelId: request.panelId,
        candidateIndex,
        candidateCount: request.candidateCount,
        characterProfiles: characterProfiles.success
          ? characterProfiles.data.characters
          : undefined,
        visualCharacterProfiles,
        styleBible,
        worldProfiles,
      });
      await consumeCloudGeneralMonitorAiRequest(profile.id, "panel_image");
      const id = await enqueueCloudGenerationJob({
        projectId: request.projectId,
        pageId: request.pageId,
        idempotencyKey:
          candidateIndex === 0
            ? request.idempotencyKey
            : `${request.idempotencyKey}:candidate:${candidateIndex + 1}`,
        generation: resolved.generation,
      });
      jobs.push({ id, candidateNumber: resolved.candidateNumber });
    } catch (error) {
      if (!jobs.length) throw error;
      partial = true;
      break;
    }
  }
  if (!resolved || !jobs.length)
    throw new DomainError("INTERNAL_ERROR", "画像生成を開始できませんでした。");
  return {
    id: jobs[0].id,
    jobs,
    panelId: resolved.panelId,
    pageNumber: resolved.pageNumber,
    panelNumber: resolved.panelNumber,
    requestedCandidateCount: request.candidateCount,
    partial,
  };
}
