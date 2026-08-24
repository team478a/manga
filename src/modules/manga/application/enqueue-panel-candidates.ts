import { pageCanvasSchema } from "@mangai/canvas-core";
import { cloudCreatorContext } from "@/modules/cloud-creator/auth-context";
import {
  enqueueCloudGenerationJob,
  prepareCloudGenerationJob,
} from "@/modules/cloud-creator/generation/generation-service";
import {
  assertGeneralStoryboardProject,
  buildStoryboardPanelGeneration,
  cloudPanelImageGenerationFeatureEnabled,
  cloudPanelInpaintingFeatureEnabled,
  cloudPanelOutpaintingFeatureEnabled,
} from "@/lib/cloud-panel-image-generation.ts";
import { cloudPanelImageGenerationRequestSchema } from "../contracts/panel-generation";
import { cloudStoryboardResultSchema } from "@/lib/cloud-storyboard.ts";
import { cloudStoryScenarioResultSchema } from "@/lib/cloud-scenario.ts";
import {
  DomainError,
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
} from "@/lib/domain-errors.ts";
import { consumeCloudGeneralMonitorAiRequest } from "@/lib/cloud-general-monitor.ts";
import type { CloudCharacterProfile } from "@/lib/cloud-character-profile.ts";
import type { CloudStyleBible, CloudWorldProfile } from "@/lib/cloud-world-bible.ts";
import { savePanelSpecification } from "@/modules/manga-quality/infrastructure/panel-quality-repository";
import { resolveVersionedCharacterReferences } from "../domain/panel-reference-policy";

function versionedCharacterReferenceResolverEnabled() {
  return process.env.CLOUD_VERSIONED_CHARACTER_REFERENCES_ENABLED === "true";
}

async function runStoryboardPanelImage(
  input: unknown,
  mode: "enqueue" | "prepare",
) {
  if (!cloudPanelImageGenerationFeatureEnabled())
    throw new PermissionDeniedError("ネーム画像生成は現在停止中です。");
  const request = cloudPanelImageGenerationRequestSchema.parse(input);
  if (request.maskAssetId && !cloudPanelInpaintingFeatureEnabled())
    throw new PermissionDeniedError("コマの部分修正は現在停止中です。");
  if (
    request.outpaintingDirection &&
    !cloudPanelOutpaintingFeatureEnabled()
  )
    throw new PermissionDeniedError("コマの画角拡張は現在停止中です。");
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
        "version_id:id,profile_id,version_number,appearance_age,body_build,hair,costume,color_palette,immutable_traits,prompt,negative_prompt",
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
  const revision = request.sourceAssetId && request.revisionPreset
    ? {
        sourceAssetId: request.sourceAssetId,
        maskAssetId: request.maskAssetId,
        outpaintingDirection: request.outpaintingDirection,
        preset: request.revisionPreset,
        instruction: request.revisionInstruction,
      }
    : undefined;
  const compositionControl =
    request.shotOverride ||
    request.cameraAngleOverride ||
    request.subjectPlacement ||
    request.gazeDirection ||
    request.compositionInstruction
      ? {
          shot: request.shotOverride ?? "storyboard",
          cameraAngle: request.cameraAngleOverride ?? "storyboard",
          subjectPlacement: request.subjectPlacement ?? "storyboard",
          gazeDirection: request.gazeDirection ?? "storyboard",
          instruction: request.compositionInstruction,
        }
      : undefined;
  if (revision) {
    const sourceLayer = canvas.panelLayers.find(
      (layer) =>
        layer.panelId === request.panelId &&
        layer.visible &&
        layer.assetId === revision.sourceAssetId,
    );
    if (!sourceLayer)
      throw new ResourceNotFoundError(
        "選択したコマに修正元画像が見つかりません。保存後に再度お試しください。",
      );
    const sourceAsset = await supabase
      .from("cloud_assets")
      .select("id,width,height,mime_type")
      .eq("id", revision.sourceAssetId)
      .eq("project_id", request.projectId)
      .eq("owner_profile_id", profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (sourceAsset.error)
      throw new DomainError(
        "INTERNAL_ERROR",
        "修正元画像を確認できませんでした。",
        { cause: sourceAsset.error },
      );
    if (!sourceAsset.data)
      throw new PermissionDeniedError("この画像を修正元として利用できません。");
    if (revision.maskAssetId) {
      const maskAsset = await supabase
        .from("cloud_assets")
        .select("id,width,height,mime_type")
        .eq("id", revision.maskAssetId)
        .eq("project_id", request.projectId)
        .eq("owner_profile_id", profile.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (maskAsset.error)
        throw new DomainError(
          "INTERNAL_ERROR",
          "修正範囲を確認できませんでした。",
          { cause: maskAsset.error },
        );
      if (!maskAsset.data || maskAsset.data.mime_type !== "image/png")
        throw new PermissionDeniedError("この修正範囲を利用できません。");
      if (
        maskAsset.data.width !== sourceAsset.data.width ||
        maskAsset.data.height !== sourceAsset.data.height
      )
        throw new ValidationError(
          "修正範囲と元画像のサイズが一致しません。もう一度範囲を指定してください。",
        );
    }
  }
  let explicitCharacterProfileIds: string[] = [];
  let explicitWorldProfileIds: string[] = [];
  let referenceAssets: Array<{
    subjectKind: "character" | "style" | "location" | "prop";
    subjectId: string;
    assetId: string;
  }> = [];
  let referenceResolution: ReturnType<typeof resolveVersionedCharacterReferences> | null = null;
  const assignments = await supabase
    .from("cloud_panel_subject_assignments")
    .select("subject_kind,subject_id")
    .eq("project_id", request.projectId)
    .eq("page_id", request.pageId)
    .eq("panel_id", request.panelId)
    .eq("owner_profile_id", profile.id);
  if (assignments.error && assignments.error.code !== "42P01")
    throw new DomainError("INTERNAL_ERROR", "コマの固定設定を読み込めませんでした。", {
      cause: assignments.error,
    });
  if (!assignments.error) {
    explicitCharacterProfileIds = (assignments.data ?? [])
      .filter((item) => item.subject_kind === "character")
      .map((item) => item.subject_id);
    explicitWorldProfileIds = (assignments.data ?? [])
      .filter((item) => item.subject_kind === "location" || item.subject_kind === "prop")
      .map((item) => item.subject_id);
    const selected = buildStoryboardPanelGeneration({
      storyboard,
      pageNumber: page.page_number,
      canvas,
      panelId: request.panelId,
      characterProfiles: characterProfiles.success
        ? characterProfiles.data.characters
        : undefined,
      visualCharacterProfiles,
      styleBible,
      worldProfiles,
      explicitCharacterProfileIds,
      explicitWorldProfileIds,
      revision,
      compositionControl,
      generationTarget: request.generationTarget,
    });
    const relevantSubjectIds = [
      ...(selected.generation.characterProfileVersions ?? []).map((item) => item.profileId),
      ...(selected.generation.worldProfileVersions ?? []).map((item) => item.profileId),
      ...(selected.generation.styleBibleVersion
        ? [selected.generation.styleBibleVersion.bibleId]
        : []),
    ];
    if (relevantSubjectIds.length) {
      const references = await supabase
        .from("cloud_visual_reference_assets")
        .select("subject_kind,subject_id,asset_id")
        .eq("project_id", request.projectId)
        .eq("owner_profile_id", profile.id)
        .in("subject_id", relevantSubjectIds)
        .order("created_at", { ascending: true })
        // Load a bounded superset so deterministic subject priority can keep
        // character identity references ahead of older style/world assets.
        .limit(32);
      if (references.error && references.error.code !== "42P01")
        throw new DomainError("INTERNAL_ERROR", "参照画像を読み込めませんでした。", {
          cause: references.error,
        });
      referenceAssets = (references.data ?? []).map((item) => ({
        subjectKind: item.subject_kind as "character" | "style" | "location" | "prop",
        subjectId: item.subject_id,
        assetId: item.asset_id,
      }));
    }
    if (versionedCharacterReferenceResolverEnabled()) {
      const characterVersions = (selected.generation.characterProfileVersions ?? []).flatMap((item) => {
        const version = visualCharacterProfiles.find(
          (profile) => profile.id === item.profileId && profile.current_version === item.version,
        ) as (CloudCharacterProfile & { version_id?: string }) | undefined;
        const versionId = version?.version_id;
        return versionId ? [{ profileId: item.profileId, versionId, version: item.version }] : [];
      });
      if (characterVersions.length !== (selected.generation.characterProfileVersions ?? []).length)
        throw new DomainError("INTERNAL_ERROR", "人物設定の版を特定できませんでした。");
      const [bindings, policy] = await Promise.all([
        characterVersions.length
          ? supabase.from("cloud_character_reference_bindings")
              .select("character_profile_id,character_version_id,asset_id,reference_role,priority")
              .eq("project_id", request.projectId).eq("owner_profile_id", profile.id)
              .eq("review_status", "approved")
              .in("character_version_id", characterVersions.map((item) => item.versionId))
          : Promise.resolve({ data: [], error: null }),
        supabase.from("cloud_project_generation_readiness_policies")
          .select("major_character_reference_policy")
          .eq("project_id", request.projectId).eq("owner_profile_id", profile.id).maybeSingle(),
      ]);
      if (bindings.error || (policy.error && policy.error.code !== "PGRST116"))
        throw new DomainError("INTERNAL_ERROR", "人物参照画像の準備状況を確認できませんでした。", { cause: bindings.error ?? policy.error });
      referenceResolution = resolveVersionedCharacterReferences({
        characters: characterVersions,
        policy: (policy.data?.major_character_reference_policy as "warn" | "block" | undefined) ?? "block",
        bindings: (bindings.data ?? []).map((item) => {
          const version = characterVersions.find((candidate) => candidate.versionId === item.character_version_id)!;
          return {
            subjectKind: "character" as const, subjectId: item.character_profile_id,
            characterVersionId: item.character_version_id, profileVersion: version.version,
            assetId: item.asset_id, role: item.reference_role as "front", priority: item.priority,
          };
        }),
      });
      if (referenceResolution.blocked)
        throw new ValidationError("主要人物の承認済み正面・顔参照画像が不足しています。参照画像を確認してから開始してください。");
      const structuredCharacterIds = new Set(characterVersions.map((item) => item.profileId));
      referenceAssets = [
        ...referenceResolution.references,
        ...referenceAssets.filter((item) => item.subjectKind !== "character" || !structuredCharacterIds.has(item.subjectId)),
      ];
    }
  }
  const jobs: Array<{ id: string; candidateNumber: number }> = [];
  const prepared: Array<{
    generation: Awaited<ReturnType<typeof prepareCloudGenerationJob>>;
    panelSpecification: ReturnType<typeof buildStoryboardPanelGeneration>["panelSpecification"];
    candidateNumber: number;
  }> = [];
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
        explicitCharacterProfileIds,
        explicitWorldProfileIds,
        referenceAssets,
        revision,
        compositionControl,
        generationTarget: request.generationTarget,
      });
      if (mode === "prepare") {
        prepared.push({
          generation: await prepareCloudGenerationJob({
            ...resolved.generation,
            ...(referenceResolution ? {
              referenceBundleVersion: referenceResolution.bundleVersion,
              referenceResolverVersion: referenceResolution.resolverVersion,
              resolvedCharacterReferences: referenceResolution.references.map((item) => ({
                profileId: item.subjectId, profileVersion: item.profileVersion,
                assetId: item.assetId, role: item.role,
              })),
              referenceReadiness: { policy: referenceResolution.policy, warnings: referenceResolution.warnings },
            } : {}),
            sourcePageRevision: page.revision,
            candidateCount: 1,
            autoAdopt: true,
          }),
          panelSpecification: resolved.panelSpecification,
          candidateNumber: resolved.candidateNumber,
        });
      } else {
        await consumeCloudGeneralMonitorAiRequest(profile.id, "panel_image");
        const id = await enqueueCloudGenerationJob({
          projectId: request.projectId,
          pageId: request.pageId,
          idempotencyKey:
            candidateIndex === 0
              ? request.idempotencyKey
              : `${request.idempotencyKey}:candidate:${candidateIndex + 1}`,
          generation: {
            ...resolved.generation,
            ...(referenceResolution ? {
              referenceBundleVersion: referenceResolution.bundleVersion,
              referenceResolverVersion: referenceResolution.resolverVersion,
              resolvedCharacterReferences: referenceResolution.references.map((item) => ({
                profileId: item.subjectId, profileVersion: item.profileVersion,
                assetId: item.assetId, role: item.role,
              })),
              referenceReadiness: { policy: referenceResolution.policy, warnings: referenceResolution.warnings },
            } : {}),
            sourcePageRevision: page.revision,
            candidateCount: request.candidateCount,
            autoAdopt: request.candidateCount === 1,
          },
        });
        try {
          await savePanelSpecification({
            client: supabase,
            generationJobId: id,
            specification: resolved.panelSpecification,
          });
        } catch {
          // Quality telemetry must never prevent an already queued generation.
        }
        jobs.push({ id, candidateNumber: resolved.candidateNumber });
      }
    } catch (error) {
      if (!jobs.length) throw error;
      partial = true;
      break;
    }
  }
  if (!resolved || (mode === "enqueue" && !jobs.length) || (mode === "prepare" && !prepared.length))
    throw new DomainError("INTERNAL_ERROR", "画像生成を開始できませんでした。");
  return {
    id: jobs[0]?.id,
    jobs,
    panelId: resolved.panelId,
    pageNumber: resolved.pageNumber,
    panelNumber: resolved.panelNumber,
    requestedCandidateCount: request.candidateCount,
    partial,
    prepared,
  };
}

export async function enqueueStoryboardPanelImage(input: unknown) {
  return runStoryboardPanelImage(input, "enqueue");
}

export async function prepareStoryboardPanelImage(input: unknown) {
  const result = await runStoryboardPanelImage(input, "prepare");
  if (result.prepared.length !== 1)
    throw new ValidationError("一括生成では1コマにつき1候補だけ準備できます。");
  return {
    ...result.prepared[0],
    panelId: result.panelId,
    pageNumber: result.pageNumber,
    panelNumber: result.panelNumber,
  };
}
