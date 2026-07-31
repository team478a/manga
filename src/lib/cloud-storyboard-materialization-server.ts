import {
  getCloudStoryboardMaterializationWithPersistence,
  materializeCloudStoryboardWithPersistence,
  type CloudStoryboardMaterialization,
  type CloudStoryboardMaterializationPersistence,
} from "./cloud-storyboard-materialization.ts";
import { createClient } from "./supabase/server.ts";

type Client = Awaited<ReturnType<typeof createClient>>;

function adapter(supabase: Client): CloudStoryboardMaterializationPersistence {
  return {
    async find(profileId, storyboardVersionId) {
      return await supabase
        .from("cloud_story_storyboard_projects")
        .select("id,owner_profile_id,storyboard_version_id,project_id,first_page_id,content_class,created_at")
        .eq("owner_profile_id", profileId)
        .eq("storyboard_version_id", storyboardVersionId)
        .maybeSingle<CloudStoryboardMaterialization>();
    },
    async materialize(storyboardVersionId) {
      return await supabase.rpc("materialize_cloud_storyboard_project", {
        p_storyboard_version_id: storyboardVersionId,
      });
    },
  };
}

export async function getCloudStoryboardMaterialization(
  profileId: string,
  storyboardVersionId: string,
) {
  return getCloudStoryboardMaterializationWithPersistence({
    profileId,
    storyboardVersionId,
    persistence: adapter(await createClient()),
  });
}

export async function materializeCloudStoryboard(storyboardVersionId: string) {
  return materializeCloudStoryboardWithPersistence({
    storyboardVersionId,
    persistence: adapter(await createClient()),
  });
}
