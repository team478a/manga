import type { Project } from "@mangai/project-core";

export type HomeProjectFilter = "all" | "general" | "adult";
export type HomeProjectSort = "recent" | "title";

/**
 * 不正なProjectレコード（id/titleを欠く等）でHome画面全体をクラッシュさせない
 * ための防御的な検証。DBの手動編集やmigration不整合など、通常の操作では
 * 起こらないはずの状態からも安全に復帰できるようにする。
 */
export function isValidHomeProject(project: Project | null | undefined): project is Project {
  return Boolean(
    project &&
      typeof project.id === "string" &&
      project.id.length > 0 &&
      typeof project.title === "string" &&
      project.title.length > 0,
  );
}

export function filterHomeProjects(
  projects: Project[],
  filter: HomeProjectFilter,
): Project[] {
  const valid = projects.filter(isValidHomeProject);
  if (filter === "all") return valid;
  return valid.filter((project) => project.contentClass === filter);
}

export function sortHomeProjects(
  projects: Project[],
  sort: HomeProjectSort,
): Project[] {
  const copy = projects.slice();
  if (sort === "title") {
    return copy.sort((a, b) => a.title.localeCompare(b.title, "ja"));
  }
  return copy.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function buildHomeProjectView(
  projects: Project[],
  options: { filter: HomeProjectFilter; sort: HomeProjectSort },
): Project[] {
  return sortHomeProjects(filterHomeProjects(projects, options.filter), options.sort);
}
