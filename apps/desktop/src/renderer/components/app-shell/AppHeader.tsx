import React from "react";
import {
  Download,
  History,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Redo2,
  Save,
  Undo2,
  Upload,
} from "lucide-react";
import type { OperationHistory } from "../../../preload/api";
import { StatusBadge, type StatusTone } from "../common/StatusBadge";
import { Button } from "../common/Button";
import { useI18n } from "../../i18n";

export function AppHeader({
  projectTitle,
  episodeTitle,
  pageNumber,
  saving,
  savingTone,
  leftPanelOpen,
  rightPanelOpen,
  history,
  exporting,
  onToggleLeftPanel,
  onToggleRightPanel,
  onBackup,
  onUndo,
  onRedo,
  onImport,
  onExport,
  onOpenCommandPalette,
  updateControl,
}: {
  projectTitle: string;
  episodeTitle?: string;
  pageNumber?: number;
  saving: string;
  savingTone: StatusTone;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  history: OperationHistory;
  exporting: boolean;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onBackup: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onImport: () => void;
  onExport: () => void;
  onOpenCommandPalette: () => void;
  updateControl: React.ReactNode;
}) {
  const { t, localizeMessage, localeCode } = useI18n();
  return (
    <header className="app-header">
      <div className="app-header-location">
        <strong>MANGAI</strong>
        <div className="app-breadcrumb" title={projectTitle}>
          <span>{projectTitle}</span>
          {episodeTitle && <span>{episodeTitle}</span>}
          {pageNumber && <span>Page {pageNumber}</span>}
        </div>
      </div>
      <StatusBadge tone={savingTone} live>
        {saving}
      </StatusBadge>
      <div className="app-header-actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenCommandPalette}
          aria-label="コマンドパレットを開く (Ctrl+K)"
          title="コマンドパレットを開く (Ctrl+K)"
        >
          <span aria-hidden="true">⌘K</span>
        </Button>
        <span className="app-header-divider" />
        <button
          className={leftPanelOpen ? "selected" : "secondary"}
          aria-pressed={leftPanelOpen}
          aria-expanded={leftPanelOpen}
          aria-controls="project-panel"
          title={t("header.toggleLeft")}
          onClick={onToggleLeftPanel}
        >
          <PanelLeft size={17} aria-hidden="true" />
          <span>{t("header.leftPanel")}</span>
        </button>
        <button
          className={rightPanelOpen ? "selected" : "secondary"}
          aria-pressed={rightPanelOpen}
          aria-expanded={rightPanelOpen}
          aria-controls="inspector-panel"
          title={t("header.toggleRight")}
          onClick={onToggleRightPanel}
        >
          <PanelRight size={17} aria-hidden="true" />
          <span>{t("header.rightPanel")}</span>
        </button>
        <span className="app-header-divider" />
        <button
          className="secondary icon-action"
          disabled={!history.canUndo}
          title={`${t("header.undo")} (Ctrl+Z)`}
          aria-label={t("header.undo")}
          onClick={onUndo}
        >
          <Undo2 size={18} aria-hidden="true" />
        </button>
        <button
          className="secondary icon-action"
          disabled={!history.canRedo}
          title={`${t("header.redo")} (Ctrl+Y / Ctrl+Shift+Z)`}
          aria-label={t("header.redo")}
          onClick={onRedo}
        >
          <Redo2 size={18} aria-hidden="true" />
        </button>
        <button className="secondary" onClick={onImport}>
          <Upload size={17} aria-hidden="true" />
          <span>{t("header.import")}</span>
        </button>
        <button
          className="primary-action"
          data-a11y-action="open-export"
          onClick={onExport}
        >
          <Download size={17} aria-hidden="true" />
          <span>{exporting ? t("header.progress") : t("header.export")}</span>
        </button>
        <details className="app-header-more" data-a11y-menu="header-more">
          <summary title={t("header.more")} aria-label={t("header.more")}>
            <MoreHorizontal size={19} aria-hidden="true" />
          </summary>
          <div className="app-header-menu">
            <button onClick={onBackup}>
              <Save size={16} aria-hidden="true" />
              {t("header.backup")}
            </button>
            <div className="app-header-history">
              <b>
                <History size={15} aria-hidden="true" /> {t("header.history")}
              </b>
              {history.items.length ? (
                history.items.slice(0, 10).map((item) => (
                  <p className={item.isUndone ? "undone" : ""} key={item.id}>
                    <span>{localizeMessage(item.label)}</span>
                    <small>
                      {item.isUndone ? t("header.undone") : ""}
                      {new Date(item.createdAt).toLocaleTimeString(localeCode)}
                    </small>
                  </p>
                ))
              ) : (
                <p>{t("header.noHistory")}</p>
              )}
            </div>
            <div className="app-header-update">{updateControl}</div>
          </div>
        </details>
      </div>
    </header>
  );
}
