import type { CloudCharacterProfile, CloudCharacterProfileInput } from "@/lib/cloud-character-profile";
import { DomainError, ResourceNotFoundError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { getCloudProjectWorkspace } from "./project-service";

export async function listCloudCharacterProfiles(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  await getCloudProjectWorkspace(projectId);
  const profiles = await supabase.from("cloud_character_profiles")
    .select("id,project_id,name,role,current_version,updated_at")
    .eq("project_id", projectId).is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (profiles.error) {
    if (profiles.error.code === "42P01") return { available: false, profiles: [] as CloudCharacterProfile[] };
    throw new DomainError("INTERNAL_ERROR", "キャラクター設定を読み込めませんでした。", { cause: profiles.error });
  }
  const ids = (profiles.data ?? []).map((profile) => profile.id);
  const versions = ids.length ? await supabase.from("cloud_character_profile_versions")
    .select("profile_id,version_number,appearance_age,body_build,hair,costume,color_palette,immutable_traits,prompt,negative_prompt")
    .in("profile_id", ids) : { data: [], error: null };
  if (versions.error) throw new DomainError("INTERNAL_ERROR", "キャラクター設定を読み込めませんでした。", { cause: versions.error });
  return {
    available: true,
    profiles: (profiles.data ?? []).map((profile) => {
      const version = (versions.data ?? []).find((item) => item.profile_id === profile.id && item.version_number === profile.current_version);
      if (!version) throw new ResourceNotFoundError("キャラクター設定の履歴が見つかりません。");
      return { ...profile, ...version } as CloudCharacterProfile;
    }),
  };
}

export async function saveCloudCharacterProfile(input: CloudCharacterProfileInput) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("save_cloud_character_profile", {
    p_project_id: input.projectId,p_profile_id: input.profileId,p_name: input.name,p_role: input.role,
    p_appearance_age: input.appearanceAge,p_body_build: input.bodyBuild,p_hair: input.hair,
    p_costume: input.costume,p_color_palette: input.colorPalette,p_immutable_traits: input.immutableTraits,
    p_prompt: input.prompt,p_negative_prompt: input.negativePrompt,
  });
  if (error || !data) throw new DomainError("INTERNAL_ERROR", "キャラクター設定を保存できませんでした。", { cause: error });
  return data as string;
}

export async function deleteCloudCharacterProfile(projectId: string, profileId: string) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("delete_cloud_character_profile", { p_project_id: projectId, p_profile_id: profileId });
  if (error) throw new DomainError("INTERNAL_ERROR", "キャラクター設定を削除できませんでした。", { cause: error });
}
