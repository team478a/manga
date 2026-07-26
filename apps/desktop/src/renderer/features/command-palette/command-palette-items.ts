import type { Project } from "@mangai/project-core";
import type {
  CommandSection,
} from "../../components/common/CommandPalette";

export type CommandPaletteActions = {
  goHome: () => void;
  goWorkspace: () => void;
  goGeneration: () => void;
  goSettings: () => void;
  goHubStatus: () => void;
  openNewProjectDialog: () => void;
  openProject: (projectId: string) => void;
  backupActiveProject: () => void;
  restoreProject: () => void;
  checkForUpdate: () => void;
};

export type CommandPaletteContext = {
  hasActiveProject: boolean;
  projects: Project[];
  formatDateTime: (value: string) => string;
  actions: CommandPaletteActions;
};

const RECENT_PROJECTS_LIMIT = 5;

/**
 * 最近開いたProjectを既存の更新日時のみで並び替える（新しい並び替えロジックは導入しない）。
 * 成人向けProjectであってもtitle等のローカル表示情報のみを使用し、Prompt・画像等は扱わない。
 */
export function getRecentProjects(
  projects: Project[],
  limit = RECENT_PROJECTS_LIMIT,
): Project[] {
  return [...projects]
    .sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, limit);
}

/**
 * コマンドパレットへ渡すセクション一覧を組み立てる純粋関数。
 * CommandPalette自身はProject/IPC/画面遷移について一切の知識を持たないため、
 * すべての実処理は呼び出し側（App.tsx）が用意したactionsコールバック経由で行う。
 *
 * 安全境界: AI Providerの直接有効化、成人向け生成の直接実行、外部送信確認の省略、
 * 費用承認の省略、APIキー変更、課金設定変更、Project削除・一括削除に該当する
 * コマンドはここに追加しない。Provider関連の操作が必要な場合は、設定画面の
 * 該当セクションを開くコマンド（goSettings）に限定する。
 */
export function buildCommandSections(
  ctx: CommandPaletteContext,
): CommandSection[] {
  const { hasActiveProject, projects, formatDateTime, actions } = ctx;

  const navigation: CommandSection = {
    id: "navigation",
    label: "移動",
    items: [
      {
        id: "nav-home",
        label: "Homeを開く",
        onSelect: actions.goHome,
      },
      ...(hasActiveProject
        ? [
            {
              id: "nav-workspace",
              label: "制作ワークスペースを開く",
              onSelect: actions.goWorkspace,
            },
            {
              id: "nav-generation",
              label: "AI画像生成を開く",
              onSelect: actions.goGeneration,
            },
            {
              id: "nav-settings",
              label: "設定を開く",
              onSelect: actions.goSettings,
            },
          ]
        : []),
    ],
  };

  const projectSection: CommandSection = {
    id: "project",
    label: "Project",
    items: [
      {
        id: "project-new",
        label: "新規Project作成画面を開く",
        onSelect: actions.openNewProjectDialog,
      },
      ...(hasActiveProject
        ? [
            {
              id: "project-backup-active",
              label: "選択中Projectのバックアップ",
              onSelect: actions.backupActiveProject,
            },
          ]
        : []),
      {
        id: "project-restore",
        label: "Project復元画面を開く",
        onSelect: actions.restoreProject,
      },
    ],
  };

  const general: CommandSection = {
    id: "general",
    label: "一般操作",
    items: [
      ...(hasActiveProject
        ? [
            {
              id: "general-settings",
              label: "設定を開く",
              onSelect: actions.goSettings,
            },
            {
              id: "general-hub-status",
              label: "Hub接続状態を開く",
              onSelect: actions.goHubStatus,
            },
          ]
        : []),
      {
        id: "general-update-check",
        label: "更新を確認する",
        onSelect: actions.checkForUpdate,
      },
    ],
  };

  const recentProjects = getRecentProjects(projects);
  const recent: CommandSection = {
    id: "recent-projects",
    label: "最近開いたProject",
    items: recentProjects.map((project) => ({
      id: `recent-${project.id}`,
      label: project.title,
      hint: formatDateTime(project.updatedAt),
      onSelect: () => actions.openProject(project.id),
    })),
  };

  return [navigation, projectSection, general, recent].filter(
    (section) => section.items.length > 0,
  );
}
