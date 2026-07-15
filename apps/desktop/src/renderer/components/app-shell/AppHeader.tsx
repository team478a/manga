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
  updateControl: React.ReactNode;
}) {
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
        <button
          className={leftPanelOpen ? "selected" : "secondary"}
          aria-pressed={leftPanelOpen}
          aria-expanded={leftPanelOpen}
          aria-controls="project-panel"
          title="構成・素材パネルを開閉"
          onClick={onToggleLeftPanel}
        >
          <PanelLeft size={17} aria-hidden="true" />
          <span>左パネル</span>
        </button>
        <button
          className={rightPanelOpen ? "selected" : "secondary"}
          aria-pressed={rightPanelOpen}
          aria-expanded={rightPanelOpen}
          aria-controls="inspector-panel"
          title="情報パネルを開閉"
          onClick={onToggleRightPanel}
        >
          <PanelRight size={17} aria-hidden="true" />
          <span>右パネル</span>
        </button>
        <span className="app-header-divider" />
        <button
          className="secondary icon-action"
          disabled={!history.canUndo}
          title="元に戻す (Ctrl+Z)"
          aria-label="元に戻す"
          onClick={onUndo}
        >
          <Undo2 size={18} aria-hidden="true" />
        </button>
        <button
          className="secondary icon-action"
          disabled={!history.canRedo}
          title="やり直す (Ctrl+Y / Ctrl+Shift+Z)"
          aria-label="やり直す"
          onClick={onRedo}
        >
          <Redo2 size={18} aria-hidden="true" />
        </button>
        <button className="secondary" onClick={onImport}>
          <Upload size={17} aria-hidden="true" />
          <span>インポート</span>
        </button>
        <button className="primary-action" onClick={onExport}>
          <Download size={17} aria-hidden="true" />
          <span>{exporting ? "進捗" : "書き出し"}</span>
        </button>
        <details className="app-header-more">
          <summary title="その他の操作" aria-label="その他の操作">
            <MoreHorizontal size={19} aria-hidden="true" />
          </summary>
          <div className="app-header-menu">
            <button onClick={onBackup}>
              <Save size={16} aria-hidden="true" />
              バックアップ
            </button>
            <div className="app-header-history">
              <b>
                <History size={15} aria-hidden="true" /> 操作履歴
              </b>
              {history.items.length ? (
                history.items.slice(0, 10).map((item) => (
                  <p className={item.isUndone ? "undone" : ""} key={item.id}>
                    <span>{item.label}</span>
                    <small>
                      {item.isUndone ? "取消済み・" : ""}
                      {new Date(item.createdAt).toLocaleTimeString("ja-JP")}
                    </small>
                  </p>
                ))
              ) : (
                <p>履歴はまだありません。</p>
              )}
            </div>
            <div className="app-header-update">{updateControl}</div>
          </div>
        </details>
      </div>
    </header>
  );
}
