import React from "react";
import type { Project } from "@mangai/project-core";
import { HomeProjectCard } from "./HomeProjectCard";
import type { TranslationKey } from "../../i18n";

export type HomeProjectGridProps = {
  projects: Project[];
  totalCount: number;
  projectCovers: Record<string, string>;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  formatDateTime: (value: string) => string;
  onOpen: (projectId: string) => void;
  onMoveAdult: (project: Project) => void;
  onBackup: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onDelete: (project: Project) => void;
};

/**
 * totalCountは絞り込み前のProject総数。0件（Project未作成）と
 * フィルタ条件に一致しない0件を区別して案内するために使う。
 */
export function HomeProjectGrid({
  projects,
  totalCount,
  projectCovers,
  t,
  formatDateTime,
  onOpen,
  onMoveAdult,
  onBackup,
  onDuplicate,
  onDelete,
}: HomeProjectGridProps) {
  if (!projects.length) {
    return (
      <div className="empty home-project-empty">
        {totalCount === 0 ? t("home.none") : t("home.filteredNone")}
      </div>
    );
  }
  return (
    <div className="home-project-grid">
      {projects.map((project) => (
        <HomeProjectCard
          key={project.id}
          project={project}
          coverUrl={projectCovers[project.id]}
          t={t}
          formatDateTime={formatDateTime}
          onOpen={onOpen}
          onMoveAdult={onMoveAdult}
          onBackup={onBackup}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
