import type {
  CloudStyleBible,
  CloudStyleBibleInput,
  CloudWorldProfile,
  CloudWorldProfileInput,
} from "@/lib/cloud-world-bible";
import { DomainError, ResourceNotFoundError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { getCloudProjectWorkspace } from "./project-service";

export async function getCloudWorldBible(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  await getCloudProjectWorkspace(projectId);
  const [bible, profiles] = await Promise.all([
    supabase.from("cloud_style_bibles")
      .select("id,project_id,current_version,updated_at")
      .eq("project_id", projectId).maybeSingle(),
    supabase.from("cloud_world_profiles")
      .select("id,project_id,kind,name,current_version,updated_at")
      .eq("project_id", projectId).is("deleted_at", null)
      .order("updated_at", { ascending: false }),
  ]);
  if (bible.error?.code === "42P01" || profiles.error?.code === "42P01")
    return { available: false, styleBible: null, profiles: [] as CloudWorldProfile[] };
  if (bible.error || profiles.error)
    throw new DomainError("INTERNAL_ERROR", "作品設定を読み込めませんでした。", { cause: bible.error ?? profiles.error });
  let styleBible: CloudStyleBible | null = null;
  if (bible.data) {
    const version = await supabase.from("cloud_style_bible_versions")
      .select("art_style,linework,shading,background_detail,composition_rules,negative_prompt")
      .eq("bible_id", bible.data.id).eq("version_number", bible.data.current_version).maybeSingle();
    if (version.error) throw new DomainError("INTERNAL_ERROR", "画風設定を読み込めませんでした。", { cause: version.error });
    if (!version.data) throw new ResourceNotFoundError("画風設定の履歴が見つかりません。");
    styleBible = { ...bible.data, ...version.data } as CloudStyleBible;
  }
  const ids = (profiles.data ?? []).map((profile) => profile.id);
  const versions = ids.length
    ? await supabase.from("cloud_world_profile_versions")
        .select("profile_id,version_number,description,visual_traits,color_palette,continuity_rules,prompt,negative_prompt")
        .in("profile_id", ids)
    : { data: [], error: null };
  if (versions.error) throw new DomainError("INTERNAL_ERROR", "場所・小物設定を読み込めませんでした。", { cause: versions.error });
  return {
    available: true,
    styleBible,
    profiles: (profiles.data ?? []).map((profile) => {
      const version = (versions.data ?? []).find((item) => item.profile_id === profile.id && item.version_number === profile.current_version);
      if (!version) throw new ResourceNotFoundError("場所・小物設定の履歴が見つかりません。");
      return { ...profile, ...version } as CloudWorldProfile;
    }),
  };
}

export async function saveCloudStyleBible(input: CloudStyleBibleInput) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("save_cloud_style_bible", {
    p_project_id: input.projectId, p_art_style: input.artStyle,
    p_linework: input.linework, p_shading: input.shading,
    p_background_detail: input.backgroundDetail,
    p_composition_rules: input.compositionRules,
    p_negative_prompt: input.negativePrompt,
  });
  if (error || !data) throw new DomainError("INTERNAL_ERROR", "画風設定を保存できませんでした。", { cause: error });
  return data as string;
}

export async function saveCloudWorldProfile(input: CloudWorldProfileInput) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("save_cloud_world_profile", {
    p_project_id: input.projectId, p_profile_id: input.profileId,
    p_kind: input.kind, p_name: input.name, p_description: input.description,
    p_visual_traits: input.visualTraits, p_color_palette: input.colorPalette,
    p_continuity_rules: input.continuityRules, p_prompt: input.prompt,
    p_negative_prompt: input.negativePrompt,
  });
  if (error || !data) throw new DomainError("INTERNAL_ERROR", "場所・小物設定を保存できませんでした。", { cause: error });
  return data as string;
}

export async function deleteCloudWorldProfile(projectId: string, profileId: string) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("delete_cloud_world_profile", {
    p_project_id: projectId, p_profile_id: profileId,
  });
  if (error) throw new DomainError("INTERNAL_ERROR", "場所・小物設定を削除できませんでした。", { cause: error });
}
