import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  isInternalPanelCacheAsset,
  type Project,
  type ProjectBundle,
} from "@mangai/project-core";
import type { EpisodeTemplateId } from "@mangai/canvas-core";
import { AISettings } from "./features/ai-settings/AISettings";
import { CreatorChat } from "./features/creator-chat/CreatorChat";
import { GenerationJobs } from "./features/generation-jobs/GenerationJobs";
import { HubStatus } from "./features/hub-status/HubStatus";
import { UpdateControl } from "./features/updater/UpdateControl";
import { MangaCanvas } from "./features/manga-canvas/MangaCanvas";
import type { StatusTone } from "./components/common/StatusBadge";
import { AppHeader } from "./components/app-shell/AppHeader";
import {
  GlobalNav,
  type WorkspaceView,
} from "./components/app-shell/GlobalNav";
import {
  InspectorPanel,
  type InspectorTab,
} from "./components/app-shell/InspectorPanel";
import { ProjectPanel } from "./components/app-shell/ProjectPanel";
import { StatusBar } from "./components/app-shell/StatusBar";
import {
  ExportDialog,
  type ExportResult,
} from "./components/app-shell/ExportDialog";
import { WorkspaceStatusControls } from "./components/app-shell/WorkspaceStatusControls";
import type {
  AutoBackupState,
  DatabaseRecoveryState,
  ExportProgress,
  ExportHistoryItem,
  OperationHistory,
} from "../preload/api";
import { I18nProvider, useI18n } from "./i18n";

const emptyForm = {
  title: "",
  subtitle: "",
  description: "",
  genre: "",
  ageRating: "全年齢" as const,
  readingDirection: "rtl" as const,
  width: 1600,
  height: 2400,
  dpi: 300,
  storagePath: "",
};
const readPanelPreference = (key: string, defaultValue: boolean) => {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? defaultValue : stored === "true";
  } catch {
    return defaultValue;
  }
};
const writePanelPreference = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // 設定保存が利用できない環境でもパネル操作は継続する。
  }
};
const readInspectorTab = (): InspectorTab => {
  try {
    const stored = localStorage.getItem("mangai.inspector-tab");
    return stored === "layers" || stored === "ai" ? stored : "properties";
  } catch {
    return "properties";
  }
};
function App() {
  const { locale, setLocale, t, formatDateTime } = useI18n();
  const newProjectButtonRef = React.useRef<HTMLButtonElement>(null);
  const projectDialogRef = React.useRef<HTMLFormElement>(null);
  const projectTitleRef = React.useRef<HTMLInputElement>(null);
  const [projects, setProjects] = React.useState<Project[]>([]),
    [projectCovers, setProjectCovers] = React.useState<Record<string, string>>(
      {},
    ),
    [bundle, setBundle] = React.useState<ProjectBundle | null>(null),
    [selectedEpisode, setSelectedEpisode] = React.useState<string | null>(null),
    [episodeTemplateId, setEpisodeTemplateId] =
      React.useState<EpisodeTemplateId>("short_8"),
    [activeTool, setActiveTool] = React.useState<
      "chat" | "settings" | "jobs" | "hub" | null
    >(null),
    [selectedPage, setSelectedPage] = React.useState<string | null>(null),
    [selectedAsset, setSelectedAsset] = React.useState<string | null>(null),
    [form, setForm] = React.useState(emptyForm),
    [creating, setCreating] = React.useState(false),
    [error, setError] = React.useState(""),
    [saving, setSaving] = React.useState(() => t("saving.saved")),
    [exportTask, setExportTask] = React.useState<{
      requestId: string;
      progress: ExportProgress;
    } | null>(null),
    [exportDialogOpen, setExportDialogOpen] = React.useState(false),
    [exportResult, setExportResult] = React.useState<ExportResult>(),
    [exportError, setExportError] = React.useState<string>(),
    [exportHistory, setExportHistory] = React.useState<ExportHistoryItem[]>([]),
    [zoom, setZoom] = React.useState(70),
    [history, setHistory] = React.useState<OperationHistory>({
      items: [],
      canUndo: false,
      canRedo: false,
    }),
    [leftPanelOpen, setLeftPanelOpen] = React.useState(() =>
      readPanelPreference("mangai.left-panel-open", window.innerWidth >= 1000),
    ),
    [rightPanelOpen, setRightPanelOpen] = React.useState(() =>
      readPanelPreference("mangai.right-panel-open", window.innerWidth >= 1366),
    ),
    [inspectorTab, setInspectorTab] =
      React.useState<InspectorTab>(readInspectorTab),
    [propertiesHost, setPropertiesHost] = React.useState<HTMLDivElement | null>(
      null,
    ),
    [layersHost, setLayersHost] = React.useState<HTMLDivElement | null>(null),
    [autoBackup, setAutoBackup] = React.useState<AutoBackupState | null>(null),
    [databaseRecovery, setDatabaseRecovery] =
      React.useState<DatabaseRecoveryState | null>(null),
    [assetUrls, setAssetUrls] = React.useState<Record<string, string>>({});
  const showError = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e));
  React.useEffect(() => setSaving(t("saving.saved")), [locale]);
  const refresh = () =>
    window.mangai.listProjects().then(async (items) => {
      setProjects(items);
      const covers = await Promise.all(
        items.map(
          async (project) =>
            [project.id, await window.mangai.projectCover(project.id)] as const,
        ),
      );
      setProjectCovers(
        Object.fromEntries(
          covers.filter(
            (entry): entry is readonly [string, string] => entry[1] !== null,
          ),
        ),
      );
    });
  React.useEffect(() => {
    void refresh();
    void window.mangai
      .databaseRecoveryStatus()
      .then(setDatabaseRecovery)
      .catch(showError);
  }, []);
  React.useEffect(() => {
    const refreshAutoBackup = () =>
      window.mangai.autoBackupStatus().then(setAutoBackup).catch(showError);
    void refreshAutoBackup();
    const timer = window.setInterval(refreshAutoBackup, 15_000);
    return () => window.clearInterval(timer);
  }, []);
  React.useEffect(() => {
    writePanelPreference("mangai.left-panel-open", leftPanelOpen);
  }, [leftPanelOpen]);
  React.useEffect(() => {
    writePanelPreference("mangai.right-panel-open", rightPanelOpen);
  }, [rightPanelOpen]);
  React.useEffect(() => {
    try {
      localStorage.setItem("mangai.inspector-tab", inspectorTab);
    } catch {
      // 設定保存が利用できない環境でもタブ操作は継続する。
    }
  }, [inspectorTab]);
  React.useEffect(() => {
    if (!creating) return;
    projectTitleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCreating(false);
        requestAnimationFrame(() => newProjectButtonRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(projectDialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
        ) ?? []),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [creating]);
  React.useEffect(
    () =>
      window.mangai.onExportProgress((progress) =>
        setExportTask((current) =>
          current && current.requestId === progress.requestId
            ? { ...current, progress }
            : current,
        ),
      ),
    [],
  );
  React.useEffect(() => {
    if (!bundle) return;
    Promise.all(
      bundle.assets.map(
        async (a) =>
          [a.id, await window.mangai.assetUrl(a.relativePath)] as const,
      ),
    )
      .then((xs) => setAssetUrls(Object.fromEntries(xs)))
      .catch(showError);
  }, [bundle?.assets]);
  const refreshHistory = (projectId: string) =>
    window.mangai.listHistory(projectId).then(setHistory);
  React.useEffect(() => {
    if (bundle && !activeTool) void refreshHistory(bundle.project.id);
  }, [bundle?.project.id, activeTool]);
  const apply = (p: Promise<ProjectBundle>) =>
    p
      .then((b) => {
        setBundle(b);
        setSelectedEpisode((current) =>
          current && b.episodes.some((episode) => episode.id === current)
            ? current
            : (b.episodes[0]?.id ?? null),
        );
        setSelectedPage((x) =>
          x && b.pages.some((p) => p.id === x) ? x : (b.pages[0]?.id ?? null),
        );
        void refresh();
        void refreshHistory(b.project.id);
        setSaving(t("saving.saved"));
      })
      .catch(showError);
  React.useEffect(() => {
    if (!bundle || activeTool) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]"))
        return;
      if (
        event.key === "Escape" &&
        rightPanelOpen &&
        window.matchMedia("(max-width: 1365px)").matches
      ) {
        event.preventDefault();
        setRightPanelOpen(false);
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (
        event.key.toLowerCase() === "z" &&
        !event.shiftKey &&
        history.canUndo
      ) {
        event.preventDefault();
        void apply(window.mangai.undo(bundle.project.id));
      } else if (
        (event.key.toLowerCase() === "y" ||
          (event.key.toLowerCase() === "z" && event.shiftKey)) &&
        history.canRedo
      ) {
        event.preventDefault();
        void apply(window.mangai.redo(bundle.project.id));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bundle, activeTool, history.canUndo, history.canRedo, rightPanelOpen]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    await apply(
      window.mangai.createProject({
        ...form,
        storagePath: form.storagePath || undefined,
      }),
    );
    setCreating(false);
  };
  const backupProject = async (projectId: string) => {
    try {
      setError("");
      const result = await window.mangai.backupProject(projectId);
      if (result)
        alert(
          `バックアップを作成しました:\n${result.filePath}\n${(result.byteSize / 1024 / 1024).toFixed(1)} MB`,
        );
    } catch (cause) {
      showError(cause);
    }
  };
  const restoreProject = async () => {
    try {
      setError("");
      const restored = await window.mangai.restoreProject();
      if (restored) await apply(Promise.resolve(restored));
    } catch (cause) {
      showError(cause);
    }
  };
  if (!bundle)
    return (
      <main id="main-content" className="home" tabIndex={-1}>
        <header>
          <div>
            <b>MANGAI Desktop</b>
            <span>{t("home.subtitle")}</span>
          </div>
          <div className="header-actions">
            <button
              className="secondary"
              disabled={autoBackup?.status === "running"}
              title={autoBackup?.message}
              onClick={async () => {
                try {
                  setAutoBackup(await window.mangai.runAutoBackup());
                } catch (cause) {
                  showError(cause);
                }
              }}
            >
              {autoBackup?.status === "running"
                ? t("home.checkingBackup")
                : t("home.autoBackup")}
            </button>
            <button className="secondary" onClick={restoreProject}>
              {t("home.restore")}
            </button>
            <button ref={newProjectButtonRef} onClick={() => setCreating(true)}>
              {t("home.newProject")}
            </button>
          </div>
          <label className="home-language">
            <span>{t("settings.language")}</span>
            <select
              value={locale}
              onChange={(event) =>
                setLocale(event.target.value === "en" ? "en" : "ja")
              }
            >
              <option value="ja">{t("settings.japanese")}</option>
              <option value="en">{t("settings.english")}</option>
            </select>
          </label>
          <UpdateControl />
        </header>
        {databaseRecovery && (
          <section className="database-recovery" role="alert">
            <div>
              <b>データベースを復旧しました</b>
              <p>
                {databaseRecovery.restoredProjects.length
                  ? `${databaseRecovery.restoredProjects.length}件のProjectをバックアップから復元しました。`
                  : "復元できるProjectバックアップがなかったため、新しいデータベースで起動しました。"}
                {databaseRecovery.failedBackups.length
                  ? ` ${databaseRecovery.failedBackups.length}件のバックアップを復元できませんでした。`
                  : ""}
              </p>
              <small>
                破損した原本の保管場所: {databaseRecovery.archiveDirectory}
              </small>
            </div>
          </section>
        )}
        {autoBackup && (
          <div
            className={`home-backup-status ${autoBackup.status}`}
            role={autoBackup.status === "error" ? "alert" : "status"}
          >
            <b>自動バックアップ:</b> {autoBackup.message}
            {autoBackup.checkedAt && (
              <small>最終確認 {formatDateTime(autoBackup.checkedAt)}</small>
            )}
          </div>
        )}
        {error && (
          <div className="error dismissible" role="alert">
            <span>{error}</span>
            <button
              className="secondary"
              aria-label={t("a11y.dismissError")}
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}
        {creating && (
          <div className="modal-backdrop">
            <form
              ref={projectDialogRef}
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-project-title"
              onSubmit={create}
            >
              <h2 id="new-project-title">{t("projectDialog.title")}</h2>
              <label>
                {t("projectDialog.name")}
                <input
                  ref={projectTitleRef}
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label>
                {t("projectDialog.subtitle")}
                <input
                  value={form.subtitle}
                  onChange={(e) =>
                    setForm({ ...form, subtitle: e.target.value })
                  }
                />
              </label>
              <label>
                {t("projectDialog.description")}
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
              <div className="grid">
                <label>
                  {t("projectDialog.genre")}
                  <input
                    value={form.genre}
                    onChange={(e) =>
                      setForm({ ...form, genre: e.target.value })
                    }
                  />
                </label>
                <label>
                  {t("projectDialog.ageRating")}
                  <select
                    value={form.ageRating}
                    onChange={(e) =>
                      setForm({ ...form, ageRating: e.target.value as any })
                    }
                  >
                    <option value="全年齢">{t("projectDialog.allAges")}</option>
                    <option value="12歳以上">{t("projectDialog.age12")}</option>
                    <option value="15歳以上">{t("projectDialog.age15")}</option>
                    <option value="成人向け">{t("projectDialog.adult")}</option>
                  </select>
                </label>
                <label>
                  {t("projectDialog.reading")}
                  <select
                    value={form.readingDirection}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        readingDirection: e.target.value as any,
                      })
                    }
                  >
                    <option value="rtl">{t("projectDialog.rtl")}</option>
                    <option value="ltr">{t("projectDialog.ltr")}</option>
                  </select>
                </label>
                <label>
                  {t("projectDialog.width")}
                  <input
                    type="number"
                    value={form.width}
                    onChange={(e) =>
                      setForm({ ...form, width: +e.target.value })
                    }
                  />
                </label>
                <label>
                  {t("projectDialog.height")}
                  <input
                    type="number"
                    value={form.height}
                    onChange={(e) =>
                      setForm({ ...form, height: +e.target.value })
                    }
                  />
                </label>
                <label>
                  DPI
                  <input
                    type="number"
                    value={form.dpi}
                    onChange={(e) => setForm({ ...form, dpi: +e.target.value })}
                  />
                </label>
              </div>
              <label>
                {t("projectDialog.folder")}
                <div className="path-picker">
                  <input
                    readOnly
                    value={form.storagePath}
                    placeholder="既定: Documents/MANGAI/projects/{projectId}"
                    title={form.storagePath || t("projectDialog.defaultFolder")}
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={async () => {
                      const selected = await window.mangai.chooseProjectStorage(
                        form.storagePath || undefined,
                      );
                      if (selected)
                        setForm((current) => ({
                          ...current,
                          storagePath: selected,
                        }));
                    }}
                  >
                    {t("projectDialog.browse")}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!form.storagePath}
                    onClick={() => setForm({ ...form, storagePath: "" })}
                  >
                    {t("projectDialog.reset")}
                  </button>
                </div>
              </label>
              <footer>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setCreating(false);
                    requestAnimationFrame(() =>
                      newProjectButtonRef.current?.focus(),
                    );
                  }}
                >
                  {t("projectDialog.cancel")}
                </button>
                <button>{t("projectDialog.create")}</button>
              </footer>
            </form>
          </div>
        )}
        <section className="projects">
          <h1>{t("home.recent")}</h1>
          {projects.length ? (
            projects.map((p) => (
              <article key={p.id}>
                <button
                  className="project-open"
                  aria-label={t("home.openProject", { title: p.title })}
                  onClick={() => apply(window.mangai.openProject(p.id))}
                >
                  <span className="cover">
                    {projectCovers[p.id] ? (
                      <img src={projectCovers[p.id]} alt="" />
                    ) : (
                      "M"
                    )}
                  </span>
                  <span className="project-summary">
                    <strong>{p.title}</strong>
                    <span>
                      {p.subtitle || p.description || t("home.noDescription")}
                    </span>
                    <small>
                      {t("home.updated", {
                        value: formatDateTime(p.updatedAt),
                      })}
                    </small>
                  </span>
                </button>
                <div className="actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void backupProject(p.id);
                    }}
                  >
                    {t("home.backup")}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void apply(window.mangai.duplicateProject(p.id));
                    }}
                  >
                    {t("home.duplicate")}
                  </button>
                  <button
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t("home.deleteConfirm", { title: p.title })))
                        window.mangai
                          .deleteProject(p.id)
                          .then(refresh)
                          .catch(showError);
                    }}
                  >
                    {t("home.delete")}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty">{t("home.none")}</div>
          )}
        </section>
      </main>
    );
  const episode =
      bundle.episodes.find((item) => item.id === selectedEpisode) ??
      bundle.episodes[0],
    pages = bundle.pages
      .filter((p) => p.episodeId === episode?.id)
      .sort((a, b) => a.orderIndex - b.orderIndex),
    page = pages.find((p) => p.id === selectedPage),
    asset = bundle.assets.find(
      (a) => a.id === (page?.imageAssetId || selectedAsset),
    );
  const openWorkspaceView = (view: WorkspaceView) =>
    setActiveTool(view === "editor" ? null : view);
  const openProjects = () => {
    setActiveTool(null);
    setBundle(null);
  };
  if (activeTool === "settings")
    return (
      <ToolShell
        active="settings"
        onSelect={openWorkspaceView}
        onProjects={openProjects}
      >
        <AISettings onClose={() => setActiveTool(null)} />
      </ToolShell>
    );
  if (activeTool === "chat")
    return (
      <ToolShell
        active="chat"
        onSelect={openWorkspaceView}
        onProjects={openProjects}
      >
        <CreatorChat
          bundle={bundle}
          episodeId={episode?.id}
          pageId={page?.id}
          onBundle={setBundle}
          onOpenSettings={() => setActiveTool("settings")}
          onClose={() => setActiveTool(null)}
        />
      </ToolShell>
    );
  if (activeTool === "jobs")
    return (
      <ToolShell
        active="jobs"
        onSelect={openWorkspaceView}
        onProjects={openProjects}
      >
        <GenerationJobs
          bundle={bundle}
          episodeId={episode?.id}
          pageId={page?.id}
          onBundle={setBundle}
          onSelectAsset={(id) => {
            setSelectedAsset(id);
            setActiveTool(null);
          }}
          onClose={() => setActiveTool(null)}
        />
      </ToolShell>
    );
  if (activeTool === "hub")
    return (
      <ToolShell
        active="hub"
        onSelect={openWorkspaceView}
        onProjects={openProjects}
      >
        <HubStatus
          projectId={bundle.project.id}
          projectTitle={bundle.project.title}
          projectDescription={bundle.project.description}
          onClose={() => setActiveTool(null)}
        />
      </ToolShell>
    );
  const runExport = async () => {
    const requestId = crypto.randomUUID();
    try {
      setExportResult(undefined);
      setExportError(undefined);
      setSaving(t("saving.exporting"));
      setExportTask({
        requestId,
        progress: {
          requestId,
          current: 0,
          total: bundle.pages.length,
          percent: 0,
          status: "rendering",
        },
      });
      const result = await window.mangai.exportProject(
        bundle.project.id,
        requestId,
      );
      setSaving(t("saving.saved"));
      setExportResult(result);
      setExportHistory(
        await window.mangai.listExportHistory(bundle.project.id),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const canceled = message.includes("キャンセル");
      setSaving(
        canceled ? t("saving.exportCanceled") : t("saving.exportFailed"),
      );
      setExportError(canceled ? t("saving.exportCanceledMessage") : message);
    } finally {
      setExportTask(null);
    }
  };
  return (
    <main
      id="main-content"
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length)
          void apply(
            window.mangai.importDroppedAssets(bundle.project.id, [
              ...e.dataTransfer.files,
            ]),
          );
      }}
    >
      <AppHeader
        projectTitle={bundle.project.title}
        episodeTitle={episode?.title}
        pageNumber={page?.pageNumber}
        saving={saving}
        savingTone={savingTone(saving)}
        leftPanelOpen={leftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        history={history}
        exporting={Boolean(exportTask)}
        onToggleLeftPanel={() => setLeftPanelOpen((value) => !value)}
        onToggleRightPanel={() => setRightPanelOpen((value) => !value)}
        onBackup={() => void backupProject(bundle.project.id)}
        onUndo={() => apply(window.mangai.undo(bundle.project.id))}
        onRedo={() => apply(window.mangai.redo(bundle.project.id))}
        onImport={() => apply(window.mangai.pickAssets(bundle.project.id))}
        onExport={() => {
          setExportDialogOpen(true);
          void window.mangai
            .listExportHistory(bundle.project.id)
            .then(setExportHistory)
            .catch(showError);
        }}
        updateControl={<UpdateControl />}
      />
      {error && (
        <div className="error floating dismissible" role="alert">
          <span>{error}</span>
          <button
            className="secondary"
            aria-label={t("a11y.dismissError")}
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}
      <ExportDialog
        open={exportDialogOpen}
        projectTitle={bundle.project.title}
        pageCount={bundle.pages.length}
        progress={exportTask?.progress}
        result={exportResult}
        error={exportError}
        history={exportHistory}
        onStart={() => void runExport()}
        onCancel={() => {
          if (exportTask) void window.mangai.cancelExport(exportTask.requestId);
        }}
        onClose={() => {
          setExportDialogOpen(false);
          setExportResult(undefined);
          setExportError(undefined);
        }}
      />
      <div className="app-shell-body">
        <GlobalNav
          active="editor"
          onSelect={openWorkspaceView}
          onProjects={openProjects}
        />
        <div
          className={`workspace${leftPanelOpen ? "" : " left-collapsed"}${rightPanelOpen ? "" : " right-collapsed"}`}
        >
          <ProjectPanel
            bundle={bundle}
            episode={episode}
            pages={pages}
            selectedPageId={selectedPage}
            selectedAssetId={selectedAsset}
            assetUrls={assetUrls}
            episodeTemplateId={episodeTemplateId}
            apply={apply}
            onBundle={setBundle}
            onSelectEpisode={setSelectedEpisode}
            onSelectPage={setSelectedPage}
            onSelectAsset={setSelectedAsset}
            onEpisodeTemplateChange={setEpisodeTemplateId}
          />
          <section className="canvas">
            <div className="zoom">
              <button onClick={() => setZoom(Math.max(20, zoom - 10))}>
                −
              </button>
              <span>{zoom}%</span>
              <button onClick={() => setZoom(Math.min(200, zoom + 10))}>
                ＋
              </button>
              <button onClick={() => setZoom(70)}>
                {t("workspace.zoomReset")}
              </button>
            </div>
            {page ? (
              <MangaCanvas
                bundle={bundle}
                page={page}
                assetUrls={assetUrls}
                selectedAssetId={selectedAsset}
                zoom={zoom}
                propertiesHost={propertiesHost}
                layersHost={layersHost}
                onOpenInspectorTab={(tab) => {
                  setRightPanelOpen(true);
                  setInspectorTab(tab);
                }}
                onApply={apply}
              />
            ) : (
              <div className="empty">{t("workspace.noPage")}</div>
            )}
          </section>
          <button
            className="inspector-scrim"
            aria-label={t("workspace.closeInspector")}
            tabIndex={-1}
            onClick={() => setRightPanelOpen(false)}
          />
          <InspectorPanel
            bundle={bundle}
            page={page}
            asset={asset}
            assetUrl={asset ? assetUrls[asset.id] : undefined}
            episodeId={episode?.id}
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            onPropertiesHost={setPropertiesHost}
            onLayersHost={setLayersHost}
            onBundle={setBundle}
            onOpenSettings={() => setActiveTool("settings")}
            apply={apply}
            saving={setSaving}
          />
        </div>
      </div>
      <StatusBar
        selectedLabel={page ? `Page ${page.pageNumber}` : bundle.project.title}
        pageSize={page ? `${page.width} × ${page.height}px` : undefined}
        dpi={bundle.project.dpi}
        zoom={zoom}
        assetCount={
          bundle.assets.filter((asset) => !isInternalPanelCacheAsset(asset))
            .length
        }
        storagePath={bundle.project.storagePath}
        activity={
          <WorkspaceStatusControls
            projectId={bundle.project.id}
            onOpenJobs={() => setActiveTool("jobs")}
            onOpenSettings={() => setActiveTool("settings")}
          />
        }
      />
    </main>
  );
}

function savingTone(value: string): StatusTone {
  if (value.includes("失敗") || value.includes("failed")) return "danger";
  if (
    value.includes("キャンセル") ||
    value.includes("canceled") ||
    value.includes("未保存")
  )
    return "warning";
  if (value.includes("中") || value.endsWith("ing…")) return "info";
  if (value.includes("保存済み") || value === "Saved") return "success";
  return "neutral";
}

function ToolShell({
  active,
  onSelect,
  onProjects,
  children,
}: {
  active: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
  onProjects: () => void;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="app tool-shell" tabIndex={-1}>
      <div className="app-shell-body">
        <GlobalNav
          active={active}
          onSelect={onSelect}
          onProjects={onProjects}
        />
        <div className="shell-tool-content">{children}</div>
      </div>
    </main>
  );
}
function AppRoot() {
  const { t } = useI18n();
  return (
    <>
      <a className="skip-link" href="#main-content">
        {t("a11y.skipMain")}
      </a>
      <App />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <AppRoot />
    </I18nProvider>
  </React.StrictMode>,
);
