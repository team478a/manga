import {
  adoptCloudScenarioWithPersistence,
  createCloudScenarioVersionWithPersistence,
  getCloudScenarioVersionWithPersistence,
  listCloudScenarioVersionsWithPersistence,
  type CloudScenarioPersistence,
  type CloudStoryScenarioVersion,
} from "./cloud-scenario-persistence.ts";
import type { CloudStoryScenarioResult } from "./cloud-scenario.ts";
import { DomainError } from "./domain-errors.ts";
import { createClient } from "./supabase/server.ts";

export type { CloudStoryScenarioVersion };
type Client = Awaited<ReturnType<typeof createClient>>;
function adapter(supabase: Client): CloudScenarioPersistence {
  const fields = "id,owner_profile_id,research_report_id,proposal_selection_id,content_class,parent_version_id,revision_instruction,result,engine_version,completed_at,created_at";
  return {
    async insertVersion(value) { return await supabase.from("cloud_story_scenario_versions").insert(value).select("id").single<{ id: string }>(); },
    async listVersions(profileId, selectionId) {
      return await supabase.from("cloud_story_scenario_versions").select(fields).eq("owner_profile_id", profileId)
        .eq("proposal_selection_id", selectionId).order("created_at", { ascending: false }).limit(50).returns<CloudStoryScenarioVersion[]>();
    },
    async findVersion(profileId, versionId) {
      return await supabase.from("cloud_story_scenario_versions").select(fields).eq("owner_profile_id", profileId)
        .eq("id", versionId).maybeSingle<CloudStoryScenarioVersion>();
    },
    async insertAdoption(value) { return await supabase.from("cloud_story_scenario_adoptions").insert(value).select("id").single<{ id: string }>(); },
    async findLatestAdoption(profileId, selectionId) {
      return await supabase.from("cloud_story_scenario_adoptions").select("id,owner_profile_id,proposal_selection_id,scenario_version_id,adopted_at")
        .eq("owner_profile_id", profileId).eq("proposal_selection_id", selectionId)
        .order("adopted_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
    },
  };
}
export async function createCloudScenarioVersion(input: {
  profileId: string; reportId: string; selectionId: string; parentVersionId?: string | null;
  contentClass?: "general" | "adult"; revisionInstruction?: string | null; result: CloudStoryScenarioResult;
}) {
  return createCloudScenarioVersionWithPersistence({ ...input, persistence: adapter(await createClient()) });
}
export async function listCloudScenarioVersions(profileId: string, selectionId: string) {
  return listCloudScenarioVersionsWithPersistence({ profileId, selectionId, persistence: adapter(await createClient()) });
}
export async function getCloudScenarioVersion(profileId: string, versionId: string) {
  return getCloudScenarioVersionWithPersistence({ profileId, versionId, persistence: adapter(await createClient()) });
}
export async function getLatestCloudScenarioAdoption(profileId: string, selectionId: string) {
  const result = await adapter(await createClient()).findLatestAdoption(profileId, selectionId);
  if (result.error) throw new DomainError("INTERNAL_ERROR", "採用状況を取得できませんでした。", { cause: result.error });
  return result.data;
}
export async function adoptCloudScenario(profileId: string, version: CloudStoryScenarioVersion) {
  return adoptCloudScenarioWithPersistence({ profileId, version, persistence: adapter(await createClient()) });
}
