import { cloudCreatorContext } from "../auth-context";
import { mapCloudStructureError } from "./structure-errors";

export async function addCloudEpisode(projectId: string, title: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("add_cloud_episode", {
    p_project_id: projectId,
    p_title: title,
  });
  if (error || !data) throw mapCloudStructureError(error, "add");
  return data as string;
}

export async function addCloudPage(episodeId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("add_cloud_page", {
    p_episode_id: episodeId,
  });
  if (error || !data) throw mapCloudStructureError(error, "add");
  return data as string;
}

export async function renameCloudEpisode(episodeId: string, title: string) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("rename_cloud_episode", {
    p_episode_id: episodeId,
    p_title: title,
  });
  if (error) throw mapCloudStructureError(error, "rename");
}

export async function moveCloudStructure(
  kind: "episode" | "page",
  id: string,
  direction: -1 | 1,
) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc(
    kind === "episode" ? "move_cloud_episode" : "move_cloud_page",
    kind === "episode"
      ? { p_episode_id: id, p_direction: direction }
      : { p_page_id: id, p_direction: direction },
  );
  if (error) throw mapCloudStructureError(error, "move");
}

export async function deleteCloudStructure(
  kind: "episode" | "page",
  id: string,
) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc(
    kind === "episode" ? "soft_delete_cloud_episode" : "soft_delete_cloud_page",
    kind === "episode" ? { p_episode_id: id } : { p_page_id: id },
  );
  if (error) throw mapCloudStructureError(error, "delete");
}
