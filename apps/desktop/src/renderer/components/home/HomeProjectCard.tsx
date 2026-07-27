import React from "react";
import type { Project } from "@mangai/project-core";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { StatusBadge } from "../common/StatusBadge";
import type { TranslationKey } from "../../i18n";

export type HomeProjectCardProps = {
  project: Project;
  coverUrl?: string;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  formatDateTime: (value: string) => string;
  onOpen: (projectId: string) => void;
  onMoveAdult: (project: Project) => void;
  onBackup: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onDelete: (project: Project) => void;
};

export function HomeProjectCard({
  project,
  coverUrl,
  t,
  formatDateTime,
  onOpen,
  onMoveAdult,
  onBackup,
  onDuplicate,
  onDelete,
}: HomeProjectCardProps) {
  return (
    <Card variant="static" className="home-project-card">
      <button
        className="project-open home-project-card-open"
        aria-label={t("home.openProject", { title: project.title })}
        onClick={() => onOpen(project.id)}
      >
        <span className="cover home-project-card-cover">
          {coverUrl ? (
            <img src={coverUrl} alt="" />
          ) : (
            <span aria-hidden="true">M</span>
          )}
        </span>
        <span className="project-summary home-project-card-summary">
          <span className="home-project-card-badges">
            <StatusBadge tone={project.contentClass === "adult" ? "warning" : "neutral"}>
              {project.contentClass === "adult"
                ? t("projectDialog.contentAdult")
                : t("projectDialog.contentGeneral")}
            </StatusBadge>
          </span>
          <strong>{project.title}</strong>
          <small>
            {t("home.updated", { value: formatDateTime(project.updatedAt) })}
          </small>
        </span>
      </button>
      <div className="actions home-project-card-actions">
        {project.contentClass === "general" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onMoveAdult(project);
            }}
          >
            {t("home.moveAdult")}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onBackup(project.id);
          }}
        >
          {t("home.backup")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate(project.id);
          }}
        >
          {t("home.duplicate")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(project);
          }}
        >
          {t("home.delete")}
        </Button>
      </div>
    </Card>
  );
}
