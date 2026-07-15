import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { MangaiDatabase } from "./database.js";
import {
  openDatabaseWithRecovery,
  type DatabaseRecoveryReport,
} from "./database-recovery.js";
import { AIService } from "./ai/service.js";
import { DesktopUpdater } from "./updater.js";
import { DiagnosticsService } from "./diagnostics.js";
import { fetchHubStatus, updateHubDraft } from "./hub-status.js";
import { safeBaseUrl } from "./ai/providers/http.js";
import {
  pollHubDeviceAuthorization,
  revokeHubDeviceAuthorization,
  startHubDeviceAuthorization,
} from "./hub-status.js";
import {
  deleteHubDeviceCredential,
  hubDeviceState,
  readHubDeviceCredential,
  saveHubDeviceCredential,
} from "./hub-device-store.js";
import {
  assetIdSchema,
  assetLibraryMetadataInputSchema,
  episodeInputSchema,
  importAssetsSchema,
  pageInputSchema,
  pagePromptSchema,
  projectIdSchema,
  projectInputSchema,
  renameProjectSchema,
  renameEpisodeSchema,
  reorderEpisodesSchema,
  reorderPagesSchema,
  setProjectCoverSchema,
  hubStatusRequestSchema,
} from "@mangai/shared";
import {
  cancelRequestSchema,
  chatRequestSchema,
  chatSessionIdSchema,
  imageJobRequestSchema,
  promptTemplateInputSchema,
  projectGenerationPolicyInputSchema,
  providerSettingsSchema,
  renameChatSchema,
  safeAssetLibraryRequestSchema,
  workflowMappingSchema,
  workflowUpdateSchema,
} from "@mangai/ai-core";
import {
  balloonInputSchema,
  canvasBatchInputSchema,
  canvasObjectIdSchema,
  episodeTemplateInputSchema,
  panelInputSchema,
  panelLayersSaveSchema,
  textObjectInputSchema,
} from "@mangai/canvas-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const smokeTest = process.argv.includes("--mangai-smoke-test");
if (smokeTest) {
  const smokeDocuments = process.env.MANGAI_SMOKE_DOCUMENTS;
  if (!smokeDocuments || !path.isAbsolute(smokeDocuments))
    throw new Error("Smoke test documents path is required.");
  fs.mkdirSync(smokeDocuments, { recursive: true });
  app.setPath("documents", smokeDocuments);
}
let store: MangaiDatabase;
let aiService: AIService;
let updater: DesktopUpdater;
let diagnostics: DiagnosticsService;
let databaseRecovery: DatabaseRecoveryReport | null = null;
type AutoBackupState = {
  status: "idle" | "running" | "success" | "error";
  checkedAt?: string;
  createdCount: number;
  skippedCount: number;
  message: string;
};
let autoBackupState: AutoBackupState = {
  status: "idle",
  createdCount: 0,
  skippedCount: 0,
  message: "自動バックアップは起動後に確認します。",
};
let autoBackupTimer: NodeJS.Timeout | undefined;
let autoBackupRunning = false;
const exportControllers = new Map<string, AbortController>();
function desktopPaths() {
  const root = path.join(app.getPath("documents"), "MANGAI");
  return {
    root,
    database: path.join(root, "mangai_local.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
}

function diagnosticsUploadEndpoint() {
  if (!app.isPackaged) return process.env.MANGAI_DIAGNOSTICS_UPLOAD_URL ?? null;
  try {
    const value = z
      .object({ endpoint: z.string().nullable() })
      .parse(
        JSON.parse(
          fs.readFileSync(
            path.join(process.resourcesPath, "diagnostics-upload-config.json"),
            "utf8",
          ),
        ),
      );
    return value.endpoint;
  } catch {
    return null;
  }
}
function handle(
  channel: string,
  fn: (value: any, event: IpcMainInvokeEvent) => any,
) {
  ipcMain.handle(channel, async (event, value) => {
    try {
      return await fn(value, event);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "処理に失敗しました。";
      diagnostics?.log("error", "ipc_handler_failed", {
        channel,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      throw new Error(message);
    }
  });
}
async function runAutoBackup() {
  if (autoBackupRunning) return autoBackupState;
  autoBackupRunning = true;
  autoBackupState = {
    ...autoBackupState,
    status: "running",
    message: "確認中…",
  };
  try {
    const result = await store.autoBackupProjects();
    autoBackupState = {
      status: result.errors.length ? "error" : "success",
      checkedAt: result.checkedAt,
      createdCount: result.created.length,
      skippedCount: result.skipped.length,
      message: result.errors.length
        ? `${result.errors.length}件のProjectをバックアップできませんでした。`
        : result.created.length
          ? `${result.created.length}件の自動バックアップを作成しました。`
          : "すべてのProjectはバックアップ済みです。",
    };
    if (result.errors.length) {
      diagnostics.log("error", "auto_backup_failed", {
        checkedAt: result.checkedAt,
        errorCount: result.errors.length,
      });
    }
  } catch (cause) {
    autoBackupState = {
      status: "error",
      checkedAt: new Date().toISOString(),
      createdCount: 0,
      skippedCount: 0,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    autoBackupRunning = false;
  }
  return autoBackupState;
}
function register() {
  handle("app:paths", () => desktopPaths());
  handle("diagnostics:state", () => diagnostics.state());
  handle("diagnostics:consent", (v) => {
    if (!v || typeof v.enabled !== "boolean")
      throw new Error("診断データ設定が不正です。");
    return diagnostics.updateConsent(v.enabled);
  });
  handle("diagnostics:open-logs", async () => {
    fs.mkdirSync(desktopPaths().logs, { recursive: true });
    const error = await shell.openPath(desktopPaths().logs);
    if (error) throw new Error(error);
    return true;
  });
  handle("diagnostics:clear-crashes", () => diagnostics.clearCrashReports());
  handle("diagnostics:upload-consent", (v) => {
    if (!v || typeof v.enabled !== "boolean")
      throw new Error("診断レポート送信設定が不正です。");
    return diagnostics.updateExternalUploadConsent(v.enabled);
  });
  handle("diagnostics:upload-pending", () =>
    diagnostics.uploadPendingCrashReports(),
  );
  handle("hub:status", (v) => {
    const input = hubStatusRequestSchema.parse(v);
    const credential = readHubDeviceCredential();
    const token =
      credential?.status === "approved" && credential.baseUrl === input.baseUrl
        ? credential.deviceToken
        : undefined;
    return fetchHubStatus(input.projectId, input.baseUrl, fetch, token);
  });
  handle("hub:draft:update", (v) => {
    const input = hubStatusRequestSchema
      .extend({
        title: projectInputSchema.shape.title,
        description: projectInputSchema.shape.description,
        expectedUpdatedAt: z.string().datetime({ offset: true }),
      })
      .parse(v);
    const credential = readHubDeviceCredential();
    if (
      !credential ||
      credential.status !== "approved" ||
      credential.baseUrl !== input.baseUrl ||
      !credential.scopes?.includes("works:write:draft")
    )
      throw new Error("Hub下書き更新の端末権限がありません。");
    return updateHubDraft(
      input.projectId,
      input.baseUrl,
      {
        title: input.title,
        description: input.description,
        expectedUpdatedAt: input.expectedUpdatedAt,
      },
      credential.deviceToken,
    );
  });
  handle("hub:device:state", () => hubDeviceState());
  handle("hub:device:start", async (v) => {
    const input = hubStatusRequestSchema.pick({ baseUrl: true }).parse(v);
    const result = await startHubDeviceAuthorization(
      input.baseUrl,
      "MANGAI Desktop",
    );
    saveHubDeviceCredential({
      baseUrl: input.baseUrl,
      deviceToken: result.deviceToken,
      userCode: result.userCode,
      verificationPath: result.verificationPath,
      expiresAt: result.expiresAt,
      status: result.status,
    });
    return hubDeviceState();
  });
  handle("hub:device:poll", async () => {
    const credential = readHubDeviceCredential();
    if (!credential) throw new Error("開始中のHub端末認証がありません。");
    const result = await pollHubDeviceAuthorization(
      credential.baseUrl,
      credential.deviceToken,
    );
    saveHubDeviceCredential({
      baseUrl: credential.baseUrl,
      deviceToken: credential.deviceToken,
      userCode: credential.userCode,
      verificationPath: credential.verificationPath,
      expiresAt: credential.expiresAt,
      status: result.status,
      approvedAt: result.approvedAt,
      tokenExpiresAt: result.tokenExpiresAt,
      scopes: result.scopes,
    });
    return hubDeviceState();
  });
  handle("hub:device:disconnect", async () => {
    const credential = readHubDeviceCredential();
    if (credential)
      await revokeHubDeviceAuthorization(
        credential.baseUrl,
        credential.deviceToken,
      );
    deleteHubDeviceCredential();
    return null;
  });
  handle("database:recovery:status", () => databaseRecovery);
  handle("update:state", () => updater.getState());
  handle("update:channel", (v) => updater.setChannel(v?.channel));
  handle("update:check", () => updater.check());
  handle("update:download", () => updater.download());
  handle("update:install", () => updater.install());
  handle("projects:list", () => store.listProjects());
  handle("projects:auto-backup:status", () => autoBackupState);
  handle("projects:auto-backup:run", () => runAutoBackup());
  handle("projects:choose-storage", async (v) => {
    const initialPath =
      v && typeof v.currentPath === "string" && v.currentPath.trim()
        ? path.resolve(v.currentPath)
        : desktopPaths().projects;
    const result = await dialog.showOpenDialog({
      title: "MANGAI Projectの保存先を選択",
      defaultPath: initialPath,
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  handle("projects:cover", (v) =>
    store.projectCover(projectIdSchema.parse(v).id),
  );
  handle("projects:create", (v) =>
    store.createProject(projectInputSchema.parse(v)),
  );
  handle("projects:open", (v) =>
    store.openProject(projectIdSchema.parse(v).id),
  );
  handle("projects:rename", (v) => {
    const x = renameProjectSchema.parse(v);
    return store.captureHistory(x.id, "プロジェクト名を変更", () =>
      store.renameProject(x.id, x.title),
    );
  });
  handle("projects:duplicate", (v) =>
    store.duplicateProject(projectIdSchema.parse(v).id),
  );
  handle("projects:backup", async (v) => {
    const id = projectIdSchema.parse(v).id;
    const project = store.bundle(id).project;
    const safeTitle =
      Array.from(project.title)
        .map((character) =>
          character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
            ? "-"
            : character,
        )
        .join("")
        .slice(0, 80) || "project";
    const backupDirectory = path.join(desktopPaths().root, "backups");
    fs.mkdirSync(backupDirectory, { recursive: true });
    const result = await dialog.showSaveDialog({
      title: "MANGAI Projectをバックアップ",
      defaultPath: path.join(
        backupDirectory,
        `${safeTitle}-${new Date().toISOString().slice(0, 10)}.mangai-backup`,
      ),
      filters: [
        { name: "MANGAI Projectバックアップ", extensions: ["mangai-backup"] },
      ],
    });
    return result.canceled || !result.filePath
      ? null
      : store.backupProject(id, result.filePath);
  });
  handle("projects:restore", async () => {
    const backupDirectory = path.join(desktopPaths().root, "backups");
    fs.mkdirSync(backupDirectory, { recursive: true });
    const result = await dialog.showOpenDialog({
      title: "MANGAI Projectバックアップを復元",
      defaultPath: backupDirectory,
      properties: ["openFile"],
      filters: [
        { name: "MANGAI Projectバックアップ", extensions: ["mangai-backup"] },
      ],
    });
    return result.canceled || !result.filePaths[0]
      ? null
      : store.restoreProject(result.filePaths[0]);
  });
  handle("projects:delete", (v) =>
    store.deleteProject(projectIdSchema.parse(v).id),
  );
  handle("projects:export", async (v, event) => {
    const id = projectIdSchema.parse(v).id;
    const requestId = String(v?.requestId ?? "");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestId,
      )
    )
      throw new Error("書き出しリクエストIDが不正です。");
    const controller = new AbortController();
    exportControllers.set(requestId, controller);
    try {
      return await store.exportProject(id, {
        signal: controller.signal,
        onProgress: (value) =>
          event.sender.send("projects:export:progress", {
            requestId,
            ...value,
          }),
      });
    } finally {
      exportControllers.delete(requestId);
    }
  });
  handle("projects:export:cancel", (v) => {
    const requestId = String(v?.requestId ?? "");
    exportControllers.get(requestId)?.abort();
    return true;
  });
  handle("projects:export:history", (v) =>
    store.listExportHistory(projectIdSchema.parse(v).id),
  );
  handle("episodes:create", (v) => {
    const x = episodeInputSchema.parse(v);
    return store.captureHistory(x.projectId, "エピソードを追加", () =>
      store.createEpisode(x.projectId, x.title),
    );
  });
  handle("episodes:rename", (v) => {
    const x = renameEpisodeSchema.parse(v);
    const projectId = store.projectIdForEpisode(x.id);
    return store.captureHistory(projectId, "エピソード名を変更", () =>
      store.renameEpisode(x.id, x.title),
    );
  });
  handle("episodes:reorder", (v) => {
    const x = reorderEpisodesSchema.parse(v);
    return store.captureHistory(x.projectId, "エピソードを並び替え", () =>
      store.reorderEpisodes(x.projectId, x.episodeIds),
    );
  });
  handle("episodes:delete", (v) => {
    const id = projectIdSchema.parse(v).id;
    const projectId = store.projectIdForEpisode(id);
    return store.captureHistory(projectId, "エピソードを削除", () =>
      store.deleteEpisode(id),
    );
  });
  handle("episodes:apply-template", (v) => {
    const input = episodeTemplateInputSchema.parse(v);
    const projectId = store.projectIdForEpisode(input.episodeId);
    return store.captureHistory(projectId, "話テンプレートを一括追加", () =>
      store.addEpisodeTemplate(input.episodeId, input.templateId),
    );
  });
  handle("projects:set-cover", (v) => {
    const x = setProjectCoverSchema.parse(v);
    return store.captureHistory(x.projectId, "表紙を変更", () =>
      store.setProjectCover(x.projectId, x.assetId),
    );
  });
  handle("pages:add", (v) => {
    const x = pageInputSchema.parse(v);
    const projectId = store.projectIdForEpisode(x.episodeId);
    return store.captureHistory(projectId, "ページを追加", () =>
      store.addPage(x.episodeId, x.imageAssetId),
    );
  });
  handle("pages:duplicate", (v) => {
    const id = projectIdSchema.parse(v).id;
    const projectId = store.projectIdForPage(id);
    return store.captureHistory(projectId, "ページを複製", () =>
      store.duplicatePage(id),
    );
  });
  handle("pages:delete", (v) => {
    const id = projectIdSchema.parse(v).id;
    const projectId = store.projectIdForPage(id);
    return store.captureHistory(projectId, "ページを削除", () =>
      store.deletePage(id),
    );
  });
  handle("pages:reorder", (v) => {
    const x = reorderPagesSchema.parse(v);
    const projectId = store.projectIdForEpisode(x.episodeId);
    return store.captureHistory(projectId, "ページを並び替え", () =>
      store.reorderPages(x.episodeId, x.pageIds),
    );
  });
  handle("pages:save", (v) => {
    const x = pagePromptSchema.parse(v);
    const projectId = store.projectIdForPage(x.id);
    return store.captureHistory(projectId, "ページ内容を編集", () =>
      store.savePage(x.id, x.prompt, x.negativePrompt, x.notes),
    );
  });
  handle("canvas:panel:save", (v) => {
    const item = panelInputSchema.parse(v);
    const projectId = store.projectIdForPage(item.pageId);
    return store.captureHistory(projectId, "コマを保存", () =>
      store.savePanel({ ...item, createdAt: "", updatedAt: "" }),
    );
  });
  handle("canvas:panel-layers:save", (v) => {
    const input = panelLayersSaveSchema.parse(v);
    const projectId = store.projectIdForCanvasObject("panel", input.panelId);
    return store.captureHistory(projectId, "コマレイヤーを保存", () =>
      store.savePanelLayers(input.panelId, input.layers),
    );
  });
  handle("canvas:balloon:save", (v) => {
    const item = balloonInputSchema.parse(v);
    const projectId = store.projectIdForPage(item.pageId);
    return store.captureHistory(projectId, "吹き出しを保存", () =>
      store.saveBalloon({ ...item, createdAt: "", updatedAt: "" }),
    );
  });
  handle("canvas:text:save", (v) => {
    const item = textObjectInputSchema.parse(v);
    const projectId = store.projectIdForPage(item.pageId);
    return store.captureHistory(projectId, "テキストを保存", () =>
      store.saveTextObject({ ...item, createdAt: "", updatedAt: "" }),
    );
  });
  handle("canvas:object:delete", (v) => {
    const item = canvasObjectIdSchema.parse(v);
    const projectId = store.projectIdForCanvasObject(item.type, item.id);
    return store.captureHistory(projectId, "Canvasオブジェクトを削除", () =>
      store.deleteCanvasObject(item.type, item.id),
    );
  });
  handle("canvas:batch:save", (v) => {
    const input = canvasBatchInputSchema.parse(v);
    const projectId = store.projectIdForPage(input.pageId);
    return store.captureHistory(projectId, "Canvasを一括更新", () =>
      store.saveCanvasBatch(input),
    );
  });
  handle("history:list", (v) =>
    store.listOperationHistory(projectIdSchema.parse(v).id),
  );
  handle("history:undo", (v) => store.undo(projectIdSchema.parse(v).id));
  handle("history:redo", (v) => store.redo(projectIdSchema.parse(v).id));
  handle("assets:pick", async (v) => {
    const projectId = projectIdSchema.parse(v).id;
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "画像", extensions: ["jpg", "jpeg", "png", "webp"] }],
    });
    return result.canceled
      ? store.openProject(projectId)
      : store.importAssets(projectId, result.filePaths);
  });
  handle("assets:import", (v) => {
    const x = importAssetsSchema.parse(v);
    return store.importAssets(x.projectId, x.paths);
  });
  handle("assets:delete", (v) => {
    const id = assetIdSchema.parse(v).id;
    const projectId = store.projectIdForAsset(id);
    return store.captureHistory(
      projectId,
      "素材を削除",
      () => store.deleteAsset(id),
      { assetIds: [id] },
    );
  });
  handle("assets:library:save", (v) =>
    store.saveAssetLibraryMetadata(assetLibraryMetadataInputSchema.parse(v)),
  );
  handle("assets:url", (v) =>
    store.assetData(
      v && typeof v.relativePath === "string" ? v.relativePath : "",
    ),
  );
  handle("ai:settings:list", () =>
    store
      .getProviderSettings()
      .filter(
        (settings) =>
          settings.providerId !== "mock" || aiService.isMockEnabled(),
      ),
  );
  handle("ai:settings:history", () => store.listAISettingsHistory());
  handle("ai:runtime", () => ({ mockEnabled: aiService.isMockEnabled() }));
  handle("ai:generation-policy:get", (v) =>
    store.getProjectGenerationPolicy(projectIdSchema.parse(v).id),
  );
  handle("ai:generation-policy:save", (v) =>
    store.saveProjectGenerationPolicy(
      projectGenerationPolicyInputSchema.parse(v),
    ),
  );
  handle("ai:settings:save", (v) => {
    const settings = providerSettingsSchema.parse(v);
    safeBaseUrl(settings.baseUrl, settings.allowedOrigins);
    return store.saveProviderSettings(settings);
  });
  handle("ai:provider:check", async (v) => {
    const id = providerSettingsSchema.shape.providerId.parse(v?.providerId);
    return aiService.provider(id).checkConnection();
  });
  handle("ai:provider:models", async (v) => {
    const id = providerSettingsSchema.shape.providerId.parse(v?.providerId),
      provider = aiService.provider(id);
    if (!("listModels" in provider) || !provider.listModels) return [];
    try {
      const models = await provider.listModels();
      store.saveAIModels(id, models);
      return models.map((model) => ({ ...model, cached: false }));
    } catch (error) {
      const cached = store.listAIModels(id);
      if (cached.length) return cached;
      throw error;
    }
  });
  handle("ai:templates:list", () => store.listPromptTemplates());
  handle("ai:templates:save", (v) =>
    store.savePromptTemplate(promptTemplateInputSchema.parse(v)),
  );
  handle("ai:templates:delete", (v) =>
    store.deletePromptTemplate(chatSessionIdSchema.parse(v).id),
  );
  handle("ai:chat:sessions", (v) =>
    store.listChatSessions(
      typeof v?.projectId === "string" ? v.projectId : undefined,
    ),
  );
  handle("ai:chat:messages", (v) =>
    store.listChatMessages(chatSessionIdSchema.parse(v).id),
  );
  handle("ai:chat:rename", (v) => {
    const input = renameChatSchema.parse(v);
    store.renameChatSession(input.id, input.title);
    return store.listChatSessions();
  });
  handle("ai:chat:delete", (v) => {
    store.deleteChatSession(chatSessionIdSchema.parse(v).id);
    return store.listChatSessions();
  });
  handle("ai:chat:send", async (v, event) => {
    const input = chatRequestSchema.parse(v);
    void aiService.sendChat(input, (message) =>
      event.sender.send("ai:chat:event", message),
    );
    return { requestId: input.requestId };
  });
  handle("ai:request:cancel", (v) => {
    aiService.cancel(cancelRequestSchema.parse(v).requestId);
    return true;
  });
  handle("ai:jobs:list", (v) =>
    store.listGenerationJobs(
      typeof v?.projectId === "string" ? v.projectId : undefined,
    ),
  );
  handle("ai:routes:list", (v) =>
    store.listGenerationRouteDecisions(projectIdSchema.parse(v).id),
  );
  handle("ai:asset-library:resolve", (v) =>
    aiService.resolveSafeAssetLibrary(safeAssetLibraryRequestSchema.parse(v)),
  );
  handle("ai:external-asset:preview", (v) =>
    aiService.previewExternalSafeAsset(safeAssetLibraryRequestSchema.parse(v)),
  );
  handle("ai:image:generate", (v) =>
    aiService.generateImage(imageJobRequestSchema.parse(v)),
  );
  handle("ai:workflows:list", () => store.listComfyWorkflows());
  handle("ai:workflows:add", async (v) => {
    const name = String(v?.name ?? "").trim();
    if (!name) throw new Error("ワークフロー名が必要です。");
    const mapping = workflowMappingSchema.parse(v?.mapping);
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "ComfyUI workflow", extensions: ["json"] }],
    });
    return result.canceled
      ? store.listComfyWorkflows()
      : store.registerComfyWorkflow(name, result.filePaths[0], mapping);
  });
  handle("ai:workflows:delete", (v) =>
    store.deleteComfyWorkflow(chatSessionIdSchema.parse(v).id),
  );
  handle("ai:workflows:update", (v) => {
    const input = workflowUpdateSchema.parse(v);
    return store.updateComfyWorkflow(input.id, input.name, input.mapping);
  });
  handle("ai:workflows:default", (v) =>
    store.setDefaultComfyWorkflow(chatSessionIdSchema.parse(v).id),
  );
  handle("ai:workflows:validate", (v) =>
    store.validateComfyWorkflow(chatSessionIdSchema.parse(v).id),
  );
  handle("ai:workflows:test", async (v) => {
    const id = chatSessionIdSchema.parse(v).id,
      validation = store.validateComfyWorkflow(id);
    if (!validation.ok) return validation;
    const connection = await aiService.provider("comfyui").checkConnection();
    return {
      ok: connection.ok,
      message: connection.ok
        ? `${validation.message}\n${connection.message}`
        : connection.message,
    };
  });
}
async function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(here, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) await win.loadURL(dev);
  else await win.loadFile(path.join(here, "../../dist-renderer/index.html"));
  return win;
}
function registerDiagnosticsHandlers() {
  process.on("uncaughtException", (cause) => {
    diagnostics.captureCrash("main.uncaughtException", cause);
    app.exit(1);
  });
  process.on("unhandledRejection", (cause) => {
    diagnostics.captureCrash("main.unhandledRejection", cause);
  });
  app.on("render-process-gone", (_event, webContents, details) => {
    diagnostics.log(
      details.reason === "clean-exit" ? "info" : "error",
      "render_process_gone",
      {
        webContentsId: webContents.id,
        reason: details.reason,
        exitCode: details.exitCode,
      },
    );
    if (details.reason !== "clean-exit")
      diagnostics.captureCrash("renderer.processGone", details, {
        webContentsId: webContents.id,
      });
  });
  app.on("child-process-gone", (_event, details) => {
    diagnostics.log("error", "child_process_gone", {
      type: details.type,
      reason: details.reason,
      exitCode: details.exitCode,
      serviceName: details.serviceName,
    });
    if (details.reason !== "clean-exit")
      diagnostics.captureCrash(
        "child.processGone",
        new Error(`Child process ended: ${details.reason}`),
        {
          type: details.type,
          reason: details.reason,
          exitCode: details.exitCode,
        },
      );
  });
  app.on("web-contents-created", (_event, contents) => {
    contents.on("unresponsive", () => {
      diagnostics.captureCrash(
        "renderer.unresponsive",
        new Error("Renderer became unresponsive"),
        {
          webContentsId: contents.id,
        },
      );
    });
  });
}
app
  .whenReady()
  .then(async () => {
    diagnostics = new DiagnosticsService(
      desktopPaths(),
      {
        appVersion: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        electronVersion: process.versions.electron,
      },
      undefined,
      { endpoint: diagnosticsUploadEndpoint() },
    );
    registerDiagnosticsHandlers();
    diagnostics.log("info", "app_started", {
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
    });
    const opened = await openDatabaseWithRecovery(desktopPaths());
    store = opened.database;
    databaseRecovery = opened.recovery;
    if (databaseRecovery) {
      diagnostics.log("warn", "database_recovered", {
        source: databaseRecovery.source,
        restoredProjectCount: databaseRecovery.restoredProjects.length,
        failedBackupCount: databaseRecovery.failedBackups.length,
      });
    }
    aiService = new AIService(store, {
      allowMock:
        !app.isPackaged || process.env.MANGAI_ENABLE_MOCK_AI === "true",
    });
    updater = new DesktopUpdater(desktopPaths().root);
    register();
    const win = await createWindow();
    if (smokeTest) {
      const rendererReady = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const deadline = Date.now() + 10000;
        const check = () => {
          const root = document.querySelector("#root");
          if (root && root.childElementCount > 0) return resolve(true);
          if (Date.now() >= deadline) return resolve(false);
          setTimeout(check, 100);
        };
        check();
      })
    `);
      if (!rendererReady) throw new Error("Renderer smoke test timed out.");
      app.quit();
      return;
    }
    setTimeout(() => void runAutoBackup(), 15_000);
    autoBackupTimer = setInterval(() => void runAutoBackup(), 30 * 60_000);
    if (updater.getState().status === "idle")
      setTimeout(() => void updater.check(), 5000);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  })
  .catch((cause) => {
    if (smokeTest) {
      diagnostics?.captureCrash("smoke_test.failed", cause);
      app.exit(1);
      return;
    }
    throw cause;
  });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  diagnostics?.log("info", "app_before_quit");
  if (autoBackupTimer) clearInterval(autoBackupTimer);
  store?.close();
});

export { desktopPaths };
