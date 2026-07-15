import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import type { Project, ProjectBundle } from "@mangai/project-core";
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
import type {
  AutoBackupState,
  DatabaseRecoveryState,
  ExportProgress,
  OperationHistory,
} from "../preload/api";

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
    [saving, setSaving] = React.useState("保存済み"),
    [exportTask, setExportTask] = React.useState<{
      requestId: string;
      progress: ExportProgress;
    } | null>(null),
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
      readPanelPreference("mangai.right-panel-open", window.innerWidth >= 1300),
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
        setSaving("保存済み");
      })
      .catch(showError);
  React.useEffect(() => {
    if (!bundle || activeTool) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]"))
        return;
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
  }, [bundle, activeTool, history.canUndo, history.canRedo]);
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
      <main className="home">
        <header>
          <div>
            <b>MANGAI Desktop</b>
            <span>漫画制作プロジェクト</span>
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
                ? "バックアップ確認中…"
                : "自動バックアップ"}
            </button>
            <button className="secondary" onClick={restoreProject}>
              バックアップから復元
            </button>
            <button onClick={() => setCreating(true)}>
              ＋ 新規プロジェクト
            </button>
          </div>
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
              <small>
                最終確認{" "}
                {new Date(autoBackup.checkedAt).toLocaleString("ja-JP")}
              </small>
            )}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {creating && (
          <form className="modal" onSubmit={create}>
            <h2>新規プロジェクト</h2>
            <label>
              タイトル
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              サブタイトル
              <input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </label>
            <label>
              説明
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <div className="grid">
              <label>
                ジャンル
                <input
                  value={form.genre}
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                />
              </label>
              <label>
                対象年齢
                <select
                  value={form.ageRating}
                  onChange={(e) =>
                    setForm({ ...form, ageRating: e.target.value as any })
                  }
                >
                  <option>全年齢</option>
                  <option>12歳以上</option>
                  <option>15歳以上</option>
                  <option>成人向け</option>
                </select>
              </label>
              <label>
                読み方向
                <select
                  value={form.readingDirection}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      readingDirection: e.target.value as any,
                    })
                  }
                >
                  <option value="rtl">右開き</option>
                  <option value="ltr">左開き</option>
                </select>
              </label>
              <label>
                幅
                <input
                  type="number"
                  value={form.width}
                  onChange={(e) => setForm({ ...form, width: +e.target.value })}
                />
              </label>
              <label>
                高さ
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
              Projectフォルダー
              <div className="path-picker">
                <input
                  readOnly
                  value={form.storagePath}
                  placeholder="既定: Documents/MANGAI/projects/{projectId}"
                  title={form.storagePath || "既定の保存先を使用"}
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
                  参照…
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!form.storagePath}
                  onClick={() => setForm({ ...form, storagePath: "" })}
                >
                  既定に戻す
                </button>
              </div>
            </label>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setCreating(false)}
              >
                キャンセル
              </button>
              <button>作成</button>
            </footer>
          </form>
        )}
        <section className="projects">
          <h1>最近開いたプロジェクト</h1>
          {projects.length ? (
            projects.map((p) => (
              <article
                key={p.id}
                onClick={() => apply(window.mangai.openProject(p.id))}
              >
                <div className="cover">
                  {projectCovers[p.id] ? (
                    <img src={projectCovers[p.id]} alt="" />
                  ) : (
                    "M"
                  )}
                </div>
                <div>
                  <h2>{p.title}</h2>
                  <p>{p.subtitle || p.description || "説明なし"}</p>
                  <small>
                    更新: {new Date(p.updatedAt).toLocaleString("ja-JP")}
                  </small>
                </div>
                <div className="actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void backupProject(p.id);
                    }}
                  >
                    バックアップ
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void apply(window.mangai.duplicateProject(p.id));
                    }}
                  >
                    複製
                  </button>
                  <button
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`「${p.title}」をゴミ箱へ移動しますか？`))
                        window.mangai
                          .deleteProject(p.id)
                          .then(refresh)
                          .catch(showError);
                    }}
                  >
                    削除
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty">プロジェクトはまだありません。</div>
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
          onClose={() => setActiveTool(null)}
        />
      </ToolShell>
    );
  const runExport = async () => {
    if (exportTask) {
      await window.mangai.cancelExport(exportTask.requestId);
      return;
    }
    const requestId = crypto.randomUUID();
    try {
      setSaving("書き出し中…");
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
      setSaving("保存済み");
      alert(
        `書き出しました:\n${result.outputDir}${result.warnings.length ? `\n\n注意:\n${result.warnings.join("\n")}` : ""}`,
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setSaving(
        message.includes("キャンセル") ? "書き出しキャンセル" : "書き出し失敗",
      );
      if (!message.includes("キャンセル")) showError(cause);
    } finally {
      setExportTask(null);
    }
  };
  return (
    <main
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
        onExport={() => void runExport()}
        updateControl={<UpdateControl />}
      />
      {error && (
        <div className="error floating" onClick={() => setError("")}>
          {error}
        </div>
      )}
      {exportTask && (
        <div className="export-progress">
          <div>
            <b>
              {exportTask.progress.status === "packaging"
                ? "PDF・ZIPを作成中"
                : `ページ ${exportTask.progress.pageNumber ?? exportTask.progress.current} / ${exportTask.progress.total}`}
            </b>
            <span>{exportTask.progress.percent}%</span>
          </div>
          <progress max="100" value={exportTask.progress.percent} />
        </div>
      )}
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
              <button onClick={() => setZoom(70)}>リセット</button>
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
              <div className="empty">
                ページを追加してください。素材を選び「全素材を連続ページ化」も利用できます。
              </div>
            )}
          </section>
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
        assetCount={bundle.assets.length}
        storagePath={bundle.project.storagePath}
      />
    </main>
  );
}

function savingTone(value: string): StatusTone {
  if (value.includes("失敗")) return "danger";
  if (value.includes("キャンセル") || value.includes("未保存"))
    return "warning";
  if (value.includes("中")) return "info";
  if (value.includes("保存済み")) return "success";
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
    <main className="app tool-shell">
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
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
