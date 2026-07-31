import {
  adoptCloudStoryboardWithPersistence, createCloudStoryboardVersionWithPersistence,
  getCloudStoryboardVersionWithPersistence, listCloudStoryboardVersionsWithPersistence,
  type CloudStoryboardPersistence, type CloudStoryboardVersion,
} from "./cloud-storyboard-persistence.ts";
import type { CloudStoryboardResult } from "./cloud-storyboard.ts";
import { DomainError } from "./domain-errors.ts";
import { createClient } from "./supabase/server.ts";
export type { CloudStoryboardVersion };
type Client = Awaited<ReturnType<typeof createClient>>;
function adapter(supabase: Client): CloudStoryboardPersistence {
  const fields = "id,owner_profile_id,scenario_version_id,parent_version_id,revision_instruction,content_class,result,engine_version,completed_at,created_at";
  return {
    async insertVersion(value) { return await supabase.from("cloud_story_storyboard_versions").insert(value).select("id").single<{ id: string }>(); },
    async listVersions(profileId, scenarioVersionId) { return await supabase.from("cloud_story_storyboard_versions").select(fields).eq("owner_profile_id", profileId).eq("scenario_version_id", scenarioVersionId).order("created_at", { ascending: false }).limit(50).returns<CloudStoryboardVersion[]>(); },
    async findVersion(profileId, versionId) { return await supabase.from("cloud_story_storyboard_versions").select(fields).eq("owner_profile_id", profileId).eq("id", versionId).maybeSingle<CloudStoryboardVersion>(); },
    async insertAdoption(value) { return await supabase.from("cloud_story_storyboard_adoptions").insert(value).select("id").single<{ id: string }>(); },
    async findLatestAdoption(profileId, scenarioVersionId) { return await supabase.from("cloud_story_storyboard_adoptions").select("id,owner_profile_id,scenario_version_id,storyboard_version_id,adopted_at").eq("owner_profile_id", profileId).eq("scenario_version_id", scenarioVersionId).order("adopted_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(); },
  };
}
export async function createCloudStoryboardVersion(input: { profileId: string; scenarioVersionId: string; parentVersionId?: string | null; revisionInstruction?: string | null; contentClass?: "general" | "adult"; result: CloudStoryboardResult }) {
  return createCloudStoryboardVersionWithPersistence({ ...input, persistence: adapter(await createClient()) });
}
export async function listCloudStoryboardVersions(profileId: string, scenarioVersionId: string) {
  return listCloudStoryboardVersionsWithPersistence({ profileId, scenarioVersionId, persistence: adapter(await createClient()) });
}
export async function getCloudStoryboardVersion(profileId: string, versionId: string) {
  return getCloudStoryboardVersionWithPersistence({ profileId, versionId, persistence: adapter(await createClient()) });
}
export async function getLatestCloudStoryboardAdoption(profileId: string, scenarioVersionId: string) {
  const result = await adapter(await createClient()).findLatestAdoption(profileId, scenarioVersionId);
  if (result.error) throw new DomainError("INTERNAL_ERROR", "採用状況を取得できませんでした。", { cause: result.error });
  return result.data;
}
export async function adoptCloudStoryboard(profileId: string, version: CloudStoryboardVersion) {
  return adoptCloudStoryboardWithPersistence({ profileId, version, persistence: adapter(await createClient()) });
}
