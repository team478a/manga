import { cloudCreatorContext } from "../auth-context";
import type {
  CloudEpisode,
  CloudPage,
  CloudProjectSummary,
} from "../contracts/types";
import {
  findActiveProjects,
  findDeletedProjects,
  findProject,
  findProjectEpisodes,
  findProjectPages,
} from "./project-repository";

export async function listCloudProjects() {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await findActiveProjects(supabase);
  if (error) throw new Error("Cloud Project一覧を読み込めませんでした。");
  return (data ?? []) as CloudProjectSummary[];
}

export async function listDeletedCloudProjects() {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await findDeletedProjects(supabase);
  if (error) throw new Error("Cloud Projectのゴミ箱を読み込めませんでした。");
  return (data ?? []) as Array<CloudProjectSummary & { deleted_at: string }>;
}

export async function getCloudProjectWorkspace(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const [{ data: project, error: projectError }, episodesResult, pagesResult] =
    await Promise.all([
      findProject(supabase, projectId),
      findProjectEpisodes(supabase, projectId),
      findProjectPages(supabase, projectId),
    ]);
  if (projectError || !project)
    throw new Error("Cloud Projectが見つかりません。");
  if (episodesResult.error || pagesResult.error)
    throw new Error("Episode／Pageを読み込めませんでした。");
  return {
    project: project as CloudProjectSummary,
    episodes: (episodesResult.data ?? []) as CloudEpisode[],
    pages: (pagesResult.data ?? []) as CloudPage[],
  };
}

export async function createCloudProject(input: {
  title: string;
  description: string;
  ageRating: "全年齢" | "12歳以上" | "15歳以上";
  readingDirection: "rtl" | "ltr";
  width: number;
  height: number;
  dpi: number;
}) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc(
    "create_cloud_project_with_first_page",
    {
      p_title: input.title,
      p_description: input.description,
      p_age_rating: input.ageRating,
      p_reading_direction: input.readingDirection,
      p_width: input.width,
      p_height: input.height,
      p_dpi: input.dpi,
    },
  );
  if (error || !data?.[0]?.project_id)
    throw new Error("Cloud Projectを作成できませんでした。");
  return data[0] as {
    project_id: string;
    episode_id: string;
    page_id: string;
  };
}

export async function renameCloudProject(
  projectId: string,
  title: string,
  description: string,
) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("rename_cloud_project", {
    p_project_id: projectId,
    p_title: title,
    p_description: description,
  });
  if (error) throw new Error("Project情報を更新できませんでした。");
}

export async function setCloudProjectCover(
  projectId: string,
  pageId: string,
) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("set_cloud_project_cover", {
    p_project_id: projectId,
    p_page_id: pageId,
  });
  if (error) throw new Error("表紙Pageを設定できませんでした。");
}

export async function setCloudProjectDeleted(
  projectId: string,
  deleted: boolean,
) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc(
    deleted ? "soft_delete_cloud_project" : "restore_cloud_project",
    { p_project_id: projectId },
  );
  if (error) {
    throw new Error(
      deleted
        ? "Cloud Projectをゴミ箱へ移動できませんでした。"
        : "Cloud Projectを復元できませんでした。",
    );
  }
  return data as string;
}
