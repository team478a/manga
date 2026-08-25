import type { CloudCreatorClient } from "../auth-context";

export const PROJECT_COLUMNS =
  "id,title,description,age_rating,reading_direction,width,height,dpi,visibility,revision,storage_bytes,source_surface,cover_page_id,completion_mode_profile,updated_at";

export function findActiveProjects(supabase: CloudCreatorClient) {
  return supabase
    .from("cloud_projects")
    .select(PROJECT_COLUMNS)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
}

export function findDeletedProjects(supabase: CloudCreatorClient) {
  return supabase
    .from("cloud_projects")
    .select(`${PROJECT_COLUMNS},deleted_at`)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
}

export function findProject(supabase: CloudCreatorClient, projectId: string) {
  return supabase
    .from("cloud_projects")
    .select(PROJECT_COLUMNS)
    .eq("id", projectId)
    .is("deleted_at", null)
    .single();
}

export function findProjectEpisodes(
  supabase: CloudCreatorClient,
  projectId: string,
) {
  return supabase
    .from("cloud_episodes")
    .select("id,project_id,title,order_index,revision")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("order_index");
}

export function findProjectPages(
  supabase: CloudCreatorClient,
  projectId: string,
) {
  return supabase
    .from("cloud_pages")
    .select(
      "id,project_id,episode_id,page_number,order_index,width,height,background_color,revision",
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("page_number");
}

export function findProjectChapters(
  supabase: CloudCreatorClient,
  projectId: string,
) {
  return supabase
    .from("cloud_chapters")
    .select("id,project_id,title,order_index,revision")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("order_index");
}

export function findProjectScenes(
  supabase: CloudCreatorClient,
  projectId: string,
) {
  return supabase
    .from("cloud_scenes")
    .select(
      "id,project_id,chapter_id,episode_id,title,summary,order_index,revision",
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("order_index");
}

export function findEpisodeChapterMappings(
  supabase: CloudCreatorClient,
  projectId: string,
) {
  return supabase
    .from("cloud_episodes")
    .select("id,chapter_id")
    .eq("project_id", projectId)
    .is("deleted_at", null);
}

export function findPageSceneMappings(
  supabase: CloudCreatorClient,
  projectId: string,
) {
  return supabase
    .from("cloud_pages")
    .select("id,scene_id")
    .eq("project_id", projectId)
    .is("deleted_at", null);
}
