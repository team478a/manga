import type { Project } from "@mangai/project-core";
import type { CommandSection } from "../../components/common/CommandPalette";

const RECENT_PROJECTS_LIMIT = 5;

/**
 * Projectレコードとして最低限有効かどうかを判定する。
 * id・titleを欠くレコードをコマンド化すると、存在しないProject IDを
 * 実行してしまう危険があるため除外する。
 */
function isValidProject(project: Project): boolean {
  return Boolean(project && project.id && project.title);
}

/**
 * 最近開いたProjectを既存の更新日時のみで並び替える（新しい並び替えロジックは
 * 導入しない）。無効なレコードは除外し、最大件数を超えない。
 * 成人向けProjectであってもtitle等のローカル表示情報のみを使用し、
 * Prompt・画像等は扱わない。
 */
export function getRecentProjects(
  projects: Project[],
  limit = RECENT_PROJECTS_LIMIT,
): Project[] {
  return projects
    .filter(isValidProject)
    .slice()
    .sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, limit);
}

/**
 * 「最近開いたProject」セクションを組み立てる。Projectが0件（または全件無効）の
 * 場合はitemsが空になり、呼び出し側でセクションごと非表示にできる。
 */
export function buildRecentProjectSection({
  projects,
  formatDateTime,
  openProject,
}: {
  projects: Project[];
  formatDateTime: (value: string) => string;
  openProject: (projectId: string) => void;
}): CommandSection {
  const recentProjects = getRecentProjects(projects);
  return {
    id: "recent-projects",
    label: "最近開いたProject",
    items: recentProjects.map((project) => ({
      id: `recent-${project.id}`,
      label: project.title,
      hint: formatDateTime(project.updatedAt),
      onSelect: () => openProject(project.id),
    })),
  };
}
