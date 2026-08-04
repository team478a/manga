import { cloudCreatorContext } from "../auth-context";
import type {
  CloudChapter,
  CloudEpisode,
  CloudLongformStructure,
  CloudPage,
  CloudProjectSummary,
  CloudScene,
} from "../contracts/types";
import {
  findActiveProjects,
  findDeletedProjects,
  findEpisodeChapterMappings,
  findPageSceneMappings,
  findProject,
  findProjectChapters,
  findProjectEpisodes,
  findProjectPages,
  findProjectScenes,
} from "./project-repository";
import { mapCloudProjectError } from "./project-errors";
import {
  attachPageThumbnailUrls,
  attachProjectThumbnailUrls,
} from "../assets/thumbnail-service";
import {
  DomainError,
  ResourceNotFoundError,
} from "../../../lib/domain-errors.ts";

export async function listCloudProjects() {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await findActiveProjects(supabase);
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "作品一覧を読み込めませんでした。",
      { cause: error },
    );
  return attachProjectThumbnailUrls(
    supabase,
    (data ?? []) as CloudProjectSummary[],
  );
}

export async function listDeletedCloudProjects() {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await findDeletedProjects(supabase);
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "作品のゴミ箱を読み込めませんでした。",
      { cause: error },
    );
  return (data ?? []) as Array<CloudProjectSummary & { deleted_at: string }>;
}

export async function getCloudProjectWorkspace(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const [
    { data: project, error: projectError },
    episodesResult,
    pagesResult,
    chaptersResult,
    scenesResult,
    episodeMappingsResult,
    pageMappingsResult,
  ] = await Promise.all([
      findProject(supabase, projectId),
      findProjectEpisodes(supabase, projectId),
      findProjectPages(supabase, projectId),
      findProjectChapters(supabase, projectId),
      findProjectScenes(supabase, projectId),
      findEpisodeChapterMappings(supabase, projectId),
      findPageSceneMappings(supabase, projectId),
    ]);
  if (projectError)
    throw new DomainError(
      "INTERNAL_ERROR",
      "作品を読み込めませんでした。",
      { cause: projectError },
    );
  if (!project)
    throw new ResourceNotFoundError("作品が見つかりません。");
  if (episodesResult.error || pagesResult.error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "話／ページを読み込めませんでした。",
      { cause: episodesResult.error ?? pagesResult.error },
    );
  const episodes = (episodesResult.data ?? []) as CloudEpisode[];
  const pages = await attachPageThumbnailUrls(
    supabase,
    (pagesResult.data ?? []) as CloudPage[],
  );
  const structureAvailable = !(
    chaptersResult.error ||
    scenesResult.error ||
    episodeMappingsResult.error ||
    pageMappingsResult.error
  );
  const fallbackChapterId = `legacy-${projectId}`;
  const fallbackChapters: CloudChapter[] = [
    {
      id: fallbackChapterId,
      project_id: projectId,
      title: "章構成（準備中）",
      order_index: 0,
      revision: 0,
    },
  ];
  const fallbackScenes: CloudScene[] = episodes.map((episode) => ({
    id: `legacy-${episode.id}`,
    project_id: projectId,
    chapter_id: fallbackChapterId,
    episode_id: episode.id,
    title: "シーン1",
    summary: "",
    order_index: 0,
    revision: 0,
  }));
  const longform: CloudLongformStructure = {
    available: structureAvailable,
    chapters: structureAvailable
      ? ((chaptersResult.data ?? []) as CloudChapter[])
      : fallbackChapters,
    scenes: structureAvailable
      ? ((scenesResult.data ?? []) as CloudScene[])
      : fallbackScenes,
    episodeChapterIds: structureAvailable
      ? Object.fromEntries(
          (episodeMappingsResult.data ?? []).flatMap((entry) =>
            typeof entry.chapter_id === "string"
              ? [[entry.id, entry.chapter_id]]
              : [],
          ),
        )
      : Object.fromEntries(episodes.map((episode) => [episode.id, fallbackChapterId])),
    pageSceneIds: structureAvailable
      ? Object.fromEntries(
          (pageMappingsResult.data ?? []).flatMap((entry) =>
            typeof entry.scene_id === "string" ? [[entry.id, entry.scene_id]] : [],
          ),
        )
      : Object.fromEntries(
          pages.map((page) => [page.id, `legacy-${page.episode_id}`]),
        ),
  };
  return {
    project: project as CloudProjectSummary,
    episodes,
    pages,
    longform,
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
    throw mapCloudProjectError(error, "create");
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
  if (error) throw mapCloudProjectError(error, "rename");
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
  if (error) throw mapCloudProjectError(error, "cover");
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
  if (error)
    throw mapCloudProjectError(error, deleted ? "delete" : "restore");
  return data as string;
}
