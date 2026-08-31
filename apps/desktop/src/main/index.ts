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
import os from "node:os";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { MangaiDatabase } from "./database.js";
import {
  openDatabaseWithRecovery,
  type DatabaseRecoveryReport,
} from "./database-recovery.js";
import { AIService } from "./ai/service.js";
import {
  loadAdultProviderPolicyTrustConfig,
  readAndVerifyAdultProviderPolicyBundle,
} from "./ai/adult-provider-policy-import.js";
import { DesktopUpdater } from "./updater.js";
import { DiagnosticsService } from "./diagnostics.js";
import {
  hardwareFromElectronGpuInfo,
  RuntimeProfileService,
} from "./runtime-profile.js";
import { fetchHubStatus, updateHubDraft } from "./hub-status.js";
import { safeBaseUrl } from "./ai/providers/http.js";
import {
  ProviderCredentialStore,
  type CredentialProviderId,
} from "./ai/provider-credential-store.js";
import {
  resolveDezgoFeatureFlags,
  type DezgoFeatureFlags,
} from "./ai/dezgo-feature-flags.js";
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
  characterProfileIdSchema,
  characterProfileInputSchema,
  characterReferenceAssetInputSchema,
  episodeInputSchema,
  importAssetsSchema,
  pageInputSchema,
  pagePromptSchema,
  projectIdSchema,
  projectContentClassChangeSchema,
  projectInputSchema,
  renameProjectSchema,
  renameEpisodeSchema,
  reorderEpisodesSchema,
  reorderPagesSchema,
  setProjectCoverSchema,
  hubStatusRequestSchema,
} from "@mangai/shared";
import {
  adultGenerationAdministratorInputSchema,
  adultGenerationConsentInputSchema,
  adultReferenceImageAssessmentInputSchema,
  cancelRequestSchema,
  chatRequestSchema,
  chatSessionIdSchema,
  externalDispatchConfirmationSchema,
  imageJobRequestSchema,
  pageBatchImageRequestSchema,
  generationQueueSettingsSchema,
  promptTemplateInputSchema,
  projectGenerationPolicyInputSchema,
  providerSettingsSchema,
  renameChatSchema,
  safeAssetLibraryRequestSchema,
  workflowMappingSchema,
  workflowUpdateSchema,
  adultLocalAISetupConsentSchema,
  evaluateAdultLocalAISetupReadiness,
} from "@mangai/ai-core";
import {
  ADULT_PILOT_ARTIFACTS,
  AdultPilotDownloader,
} from "./adult-pilot-downloader.js";
import { AdultPilotRuntimeInstaller, ADULT_PILOT_RUNTIME_DIRECTORY } from "./adult-pilot-runtime-installer.js";
import { AdultPilot7ZipAdapter, findSupported7Zip } from "./adult-pilot-7zip.js";
import { configureAdultPilotRuntime } from "./adult-pilot-runtime-config.js";
import { AdultPilotRuntimeSupervisor, resolveAdultPilotRuntimeLaunch } from "./adult-pilot-runtime-supervisor.js";
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
const accessibilityTest = process.argv.includes("--mangai-accessibility-test");
const automatedRendererTest = smokeTest || accessibilityTest;
if (automatedRendererTest) {
  const smokeDocuments = process.env.MANGAI_SMOKE_DOCUMENTS;
  if (!smokeDocuments || !path.isAbsolute(smokeDocuments))
    throw new Error("Automated renderer test documents path is required.");
  const testUserData = process.env.MANGAI_TEST_USER_DATA;
  if (!testUserData || !path.isAbsolute(testUserData))
    throw new Error("Automated renderer test user data path is required.");
  fs.mkdirSync(smokeDocuments, { recursive: true });
  fs.mkdirSync(testUserData, { recursive: true });
  app.setPath("documents", smokeDocuments);
  app.setPath("userData", testUserData);
}
let store: MangaiDatabase;
let aiService: AIService;
let updater: DesktopUpdater;
let diagnostics: DiagnosticsService;
let runtimeProfile: RuntimeProfileService;
let providerCredentials: ProviderCredentialStore;
let dezgoFeatures: DezgoFeatureFlags;
let databaseRecovery: DatabaseRecoveryReport | null = null;
let adultPilotDownloadAbort: AbortController | null = null;
let adultPilotSelectedRoot: string | null = null;
let adultPilotInstallRunning = false;
const adultPilotRuntimeSupervisor = new AdultPilotRuntimeSupervisor();
const adultPilotRuntimeStatus = () => {
  let available = false;
  if (adultPilotSelectedRoot) {
    try {
      resolveAdultPilotRuntimeLaunch(path.join(adultPilotSelectedRoot, "runtime", ADULT_PILOT_RUNTIME_DIRECTORY));
      available = true;
    } catch {
      available = false;
    }
  }
  return { ...adultPilotRuntimeSupervisor.status(), available };
};
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
const bulkControllers = new Map<string, AbortController>();
const dezgoCredentialSchema = z.object({
  providerId: z.literal("dezgo"),
  apiKey: z.string().trim().min(8).max(4096),
});
const credentialProviderSchema = z.object({
  providerId: z.literal("dezgo"),
});
const providerIdSchema = z.enum(["ollama", "comfyui", "mock", "dezgo"]);

function requireDezgoByok() {
  if (
    !dezgoFeatures.dezgoProviderEnabled ||
    !dezgoFeatures.dezgoDirectByokEnabled
  )
    throw new Error("Dezgo BYOKはこのビルドで無効です。");
}
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
function adultProviderPolicyTrustedKeys() {
  const filePath = app.isPackaged
    ? path.join(process.resourcesPath, "adult-provider-policy-trust.json")
    : path.join(app.getAppPath(), "build", "adult-provider-policy-trust.json");
  return loadAdultProviderPolicyTrustConfig(filePath);
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
  handle("projects:create", (v) => {
    const input = projectInputSchema.parse(v);
    if (input.contentClass === "adult" && !input.adultProjectAcknowledged)
      throw new Error(
        "成人向けProjectのローカル保存・外部送信禁止を確認してください。",
      );
    return store.createProject(input);
  });
  handle("projects:open", async (v) => {
    const projectId = projectIdSchema.parse(v).id;
    store.openProject(projectId);
    return store.refreshPanelLayerCaches(projectId);
  });
  handle("projects:rename", (v) => {
    const x = renameProjectSchema.parse(v);
    return store.captureHistory(x.id, "プロジェクト名を変更", () =>
      store.renameProject(x.id, x.title),
    );
  });
  handle("projects:content-class", (v) => {
    const input = projectContentClassChangeSchema.parse(v);
    return store.changeProjectContentClass(input.id, input.contentClass);
  });
  handle("projects:duplicate", (v) =>
    store.duplicateProject(projectIdSchema.parse(v).id),
  );
  handle("projects:backup", async (v, event) => {
    const id = projectIdSchema.parse(v).id;
    const requestId = String(v?.requestId ?? "");
    if (!z.string().uuid().safeParse(requestId).success)
      throw new Error("バックアップリクエストIDが不正です。");
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
    if (result.canceled || !result.filePath) return null;
    const controller = new AbortController();
    bulkControllers.set(requestId, controller);
    try {
      return await store.backupProject(id, result.filePath, {
        signal: controller.signal,
        onProgress: (progress) =>
          event.sender.send("projects:bulk:progress", {
            requestId,
            operation: "backup",
            ...progress,
          }),
      });
    } finally {
      bulkControllers.delete(requestId);
    }
  });
  handle("projects:restore", async (v, event) => {
    const requestId = String(v?.requestId ?? "");
    if (!z.string().uuid().safeParse(requestId).success)
      throw new Error("復元リクエストIDが不正です。");
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
    if (result.canceled || !result.filePaths[0]) return null;
    const controller = new AbortController();
    bulkControllers.set(requestId, controller);
    try {
      return await store.restoreProject(result.filePaths[0], {
        signal: controller.signal,
        onProgress: (progress) =>
          event.sender.send("projects:bulk:progress", {
            requestId,
            operation: "restore",
            ...progress,
          }),
      });
    } finally {
      bulkControllers.delete(requestId);
    }
  });
  handle("projects:bulk:cancel", (v) => {
    const requestId = String(v?.requestId ?? "");
    bulkControllers.get(requestId)?.abort();
    return true;
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
  handle("canvas:panel:save", async (v) => {
    const item = panelInputSchema.parse(v);
    const projectId = store.projectIdForPage(item.pageId);
    store.captureHistory(projectId, "コマを保存", () =>
      store.savePanel({ ...item, createdAt: "", updatedAt: "" }),
    );
    return store.refreshPanelLayerCaches(projectId, [item.id]);
  });
  handle("canvas:panel-layers:save", async (v) => {
    const input = panelLayersSaveSchema.parse(v);
    const projectId = store.projectIdForCanvasObject("panel", input.panelId);
    store.captureHistory(projectId, "コマレイヤーを保存", () =>
      store.savePanelLayers(input.panelId, input.layers),
    );
    return store.refreshPanelLayerCaches(projectId, [input.panelId]);
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
  handle("canvas:batch:save", async (v) => {
    const input = canvasBatchInputSchema.parse(v);
    const projectId = store.projectIdForPage(input.pageId);
    store.captureHistory(projectId, "Canvasを一括更新", () =>
      store.saveCanvasBatch(input),
    );
    return store.refreshPanelLayerCaches(
      projectId,
      input.panels.map((panel) => panel.id),
    );
  });
  handle("history:list", (v) =>
    store.listOperationHistory(projectIdSchema.parse(v).id),
  );
  handle("history:undo", async (v) => {
    const projectId = projectIdSchema.parse(v).id;
    store.undo(projectId);
    return store.refreshPanelLayerCaches(projectId);
  });
  handle("history:redo", async (v) => {
    const projectId = projectIdSchema.parse(v).id;
    store.redo(projectId);
    return store.refreshPanelLayerCaches(projectId);
  });
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
  handle("characters:list", (v) =>
    store.listCharacterProfiles(projectIdSchema.parse(v).id),
  );
  handle("characters:save", (v) =>
    store.saveCharacterProfile(characterProfileInputSchema.parse(v)),
  );
  handle("characters:delete", (v) =>
    store.deleteCharacterProfile(characterProfileIdSchema.parse(v).id),
  );
  handle("characters:reference:attach", (v) =>
    store.attachCharacterReferenceAsset(
      characterReferenceAssetInputSchema.parse(v),
    ),
  );
  handle("characters:reference:detach", (v) =>
    store.detachCharacterReferenceAsset(v),
  );
  handle("assets:adult-reference-assessments:list", (v) =>
    store.listAdultReferenceImageAssessments(projectIdSchema.parse(v).id),
  );
  handle("assets:adult-reference-assessment:save", (v) =>
    store.saveAdultReferenceImageAssessment(
      adultReferenceImageAssessmentInputSchema.parse(v),
    ),
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
  handle("ai:adult-settings:get", () => aiService.getAdultGenerationSettings());
  handle("ai:adult-provider-policy:get", () => ({
    ...aiService.getAdultProviderPolicyState(),
    importAvailable: adultProviderPolicyTrustedKeys().length > 0,
  }));
  handle("ai:adult-provider-policy:import", async () => {
    const trustedKeys = adultProviderPolicyTrustedKeys();
    if (!trustedKeys.length)
      throw new Error("成人向け運用policyの信頼鍵が設定されていません。");
    const result = await dialog.showOpenDialog({
      title: "署名済み成人向け運用policyを選択",
      properties: ["openFile"],
      filters: [{ name: "MANGAI成人向け運用policy", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const verified = readAndVerifyAdultProviderPolicyBundle(
      result.filePaths[0],
      trustedKeys,
    );
    return {
      ...store.applyAdultProviderPolicyBundle(verified),
      importAvailable: true,
    };
  });
  handle("ai:adult-settings:administrator", (v) =>
    aiService.setAdultGenerationAdministratorEnabled(
      adultGenerationAdministratorInputSchema.parse(v).enabled,
    ),
  );
  handle("ai:adult-settings:confirm", (v) =>
    aiService.confirmAdultGeneration18Plus(
      adultGenerationConsentInputSchema.parse(v),
    ),
  );
  handle("ai:adult-settings:revoke", () =>
    aiService.revokeAdultGenerationConsent(),
  );
  handle("ai:runtime", () => ({
    mockEnabled: aiService.isMockEnabled(),
    runtimeProfile: runtimeProfile.getState(),
    dezgo: dezgoFeatures,
  }));
  handle("ai:adult-pilot:choose-directory", async () => {
    const result = await dialog.showOpenDialog({
      title: "成人向けローカルAIの保存先を選択",
      defaultPath: desktopPaths().root,
      properties: ["openDirectory", "createDirectory"],
    });
    adultPilotSelectedRoot = result.canceled
      ? null
      : path.resolve(result.filePaths[0]);
    return adultPilotSelectedRoot;
  });
  handle("ai:adult-pilot:download", async (v, event) => {
    if (adultPilotDownloadAbort)
      throw new Error("成人向けローカルAIの取得はすでに実行中です。");
    const consent = adultLocalAISetupConsentSchema.parse(v?.consent);
    const readiness = evaluateAdultLocalAISetupReadiness(
      runtimeProfile.getState(),
      consent,
    );
    if (!readiness.acquisitionReady)
      throw new Error("この端末は成人向けPilotの取得条件を満たしていません。");
    if (
      typeof v?.root !== "string" ||
      !path.isAbsolute(v.root) ||
      path.resolve(v.root) !== adultPilotSelectedRoot
    )
      throw new Error("成人向けローカルAIの保存先を選択してください。");
    adultPilotDownloadAbort = new AbortController();
    const downloader = new AdultPilotDownloader();
    try {
      for (let index = 0; index < ADULT_PILOT_ARTIFACTS.length; index += 1) {
        const artifact = ADULT_PILOT_ARTIFACTS[index];
        event.sender.send("ai:adult-pilot:progress", {
          artifactId: artifact.id,
          artifactIndex: index + 1,
          artifactCount: ADULT_PILOT_ARTIFACTS.length,
          downloadedBytes: 0,
          totalBytes: artifact.bytes,
          status: "downloading",
        });
        await downloader.download(
          v.root,
          artifact.id,
          adultPilotDownloadAbort.signal,
          (downloadedBytes, totalBytes) =>
            event.sender.send("ai:adult-pilot:progress", {
              artifactId: artifact.id,
              artifactIndex: index + 1,
              artifactCount: ADULT_PILOT_ARTIFACTS.length,
              downloadedBytes,
              totalBytes,
              status: "downloading",
            }),
        );
        event.sender.send("ai:adult-pilot:progress", {
          artifactId: artifact.id,
          artifactIndex: index + 1,
          artifactCount: ADULT_PILOT_ARTIFACTS.length,
          downloadedBytes: artifact.bytes,
          totalBytes: artifact.bytes,
          status: "verified",
        });
      }
      return { status: "verified", artifactCount: ADULT_PILOT_ARTIFACTS.length };
    } catch (cause) {
      if (adultPilotDownloadAbort.signal.aborted) return { status: "canceled", artifactCount: 0 };
      throw cause;
    } finally {
      adultPilotDownloadAbort = null;
    }
  });
  handle("ai:adult-pilot:cancel", () => {
    const running = Boolean(adultPilotDownloadAbort);
    adultPilotDownloadAbort?.abort();
    return running;
  });
  handle("ai:adult-pilot:install-runtime", async (v) => {
    if (adultPilotDownloadAbort || adultPilotInstallRunning)
      throw new Error("成人向けローカルAIの取得または展開はすでに実行中です。");
    const consent = adultLocalAISetupConsentSchema.parse(v?.consent);
    const readiness = evaluateAdultLocalAISetupReadiness(runtimeProfile.getState(), consent);
    if (!readiness.acquisitionReady)
      throw new Error("この端末は成人向けPilotの展開条件を満たしていません。");
    if (
      typeof v?.root !== "string" ||
      !path.isAbsolute(v.root) ||
      path.resolve(v.root) !== adultPilotSelectedRoot
    ) throw new Error("成人向けローカルAIの保存先を選択してください。");
    const executable = findSupported7Zip();
    if (!executable)
      throw new Error("安全な展開には正式インストール済みの7-Zip 25.01以上が必要です。");
    adultPilotInstallRunning = true;
    try {
      const downloader = new AdultPilotDownloader();
      const archive = await downloader.verifyExisting(v.root, "runtime");
      await Promise.all([
        downloader.verifyExisting(v.root, "checkpoint"),
        downloader.verifyExisting(v.root, "vae"),
        downloader.verifyExisting(v.root, "controlnet"),
      ]);
      const adapter = new AdultPilot7ZipAdapter(executable);
      const entries = await adapter.list(archive.filePath);
      const result = await new AdultPilotRuntimeInstaller().install(
        v.root,
        entries,
        (staging) => adapter.extract(archive.filePath, staging),
        (extractedRoot) => {
          configureAdultPilotRuntime(extractedRoot, path.join(v.root, "models"));
        },
      );
      return { status: "installed", runtimePath: result.runtimePath, entryCount: result.entryCount };
    } finally {
      adultPilotInstallRunning = false;
    }
  });
  handle("ai:adult-pilot:runtime-status", adultPilotRuntimeStatus);
  handle("ai:adult-pilot:start-runtime", async (v) => {
    if (adultPilotDownloadAbort || adultPilotInstallRunning)
      throw new Error("成人向けローカルAIの取得または展開中はRuntimeを起動できません。");
    const consent = adultLocalAISetupConsentSchema.parse(v?.consent),
      readiness = evaluateAdultLocalAISetupReadiness(runtimeProfile.getState(), consent);
    if (!readiness.acquisitionReady)
      throw new Error("この端末は成人向けPilotの起動条件を満たしていません。");
    if (typeof v?.root !== "string" || path.resolve(v.root) !== adultPilotSelectedRoot)
      throw new Error("成人向けローカルAIの保存先を選択してください。");
    const downloader = new AdultPilotDownloader();
    await Promise.all([
      downloader.verifyExisting(v.root, "checkpoint"),
      downloader.verifyExisting(v.root, "vae"),
      downloader.verifyExisting(v.root, "controlnet"),
    ]);
    const state = await adultPilotRuntimeSupervisor.start(path.join(v.root, "runtime", ADULT_PILOT_RUNTIME_DIRECTORY));
    return { ...state, available: true };
  });
  handle("ai:adult-pilot:stop-runtime", () => {
    adultPilotRuntimeSupervisor.stop();
    return adultPilotRuntimeStatus();
  });
  handle("ai:phase5:hardware-evidence:export", async (v) => {
    const projectId = projectIdSchema.parse(v).id;
    const evidence = store.createPhase5HardwareEvidence(
      projectId,
      runtimeProfile.getState(),
    );
    const directory = path.join(desktopPaths().root, "acceptance");
    fs.mkdirSync(directory, { recursive: true });
    const result = await dialog.showSaveDialog({
      title: "Phase 5 Windows実機証跡を保存",
      defaultPath: path.join(
        directory,
        `phase5-${evidence.profile}-${new Date().toISOString().slice(0, 10)}.json`,
      ),
      filters: [{ name: "MANGAI Phase 5実機証跡", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, JSON.stringify(evidence, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    return { filePath: result.filePath, evidence };
  });
  handle("ai:credential:state", async (v) => {
    const { providerId } = credentialProviderSchema.parse(v);
    if (!dezgoFeatures.dezgoProviderEnabled)
      return { providerId, configured: false, available: false };
    try {
      return {
        providerId,
        configured: await providerCredentials.has(providerId),
        available: true,
      };
    } catch {
      return { providerId, configured: false, available: false };
    }
  });
  handle("ai:credential:save", async (v) => {
    requireDezgoByok();
    const input = dezgoCredentialSchema.parse(v);
    await providerCredentials.set(
      input.providerId as CredentialProviderId,
      input.apiKey,
    );
    return { providerId: input.providerId, configured: true };
  });
  handle("ai:credential:delete", async (v) => {
    requireDezgoByok();
    const { providerId } = credentialProviderSchema.parse(v);
    await providerCredentials.delete(providerId);
    return { providerId, configured: false };
  });
  handle("ai:runtime:save", (v) => runtimeProfile.saveSelection(v?.selection));
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
    const id = providerIdSchema.parse(v?.providerId);
    return aiService.provider(id).checkConnection();
  });
  handle("ai:comfyui:low-spec-runtime", () =>
    aiService.inspectComfyLowSpecRuntime(),
  );
  handle("ai:provider:models", async (v) => {
    const id = providerIdSchema.parse(v?.providerId);
    const provider = aiService.provider(id);
    const cached = store.listAIModels(id);
    const newestCache = Math.max(
      ...cached.map((model) => Date.parse(model.updatedAt)),
      0,
    );
    if (
      id === "dezgo" &&
      !v?.refresh &&
      cached.length &&
      Date.now() - newestCache < 24 * 60 * 60 * 1000
    )
      return cached;
    if (!("listModels" in provider) || !provider.listModels) return [];
    try {
      const models = await provider.listModels();
      store.saveAIModels(id, models);
      return models.map((model) => ({ ...model, cached: false }));
    } catch (error) {
      if (cached.length) return cached;
      throw error;
    }
  });
  handle("ai:provider:balance", async (v) => {
    const id = z.literal("dezgo").parse(v?.providerId);
    const provider = aiService.provider(id);
    if (!("getBalance" in provider) || !provider.getBalance) return null;
    return { providerId: id, balanceUsd: await provider.getBalance() };
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
  handle("ai:queue:settings:get", () => aiService.getQueueSettings());
  handle("ai:queue:settings:save", (v) =>
    aiService.saveQueueSettings(generationQueueSettingsSchema.parse(v)),
  );
  handle("ai:jobs:pause", (v) =>
    aiService.pauseImageJob(chatSessionIdSchema.parse(v).id),
  );
  handle("ai:jobs:resume", (v) =>
    aiService.resumeImageJob(chatSessionIdSchema.parse(v).id),
  );
  handle("ai:jobs:priority", (v) => {
    const id = chatSessionIdSchema.parse(v).id;
    const delta = z.number().int().min(-1).max(1).parse(v?.delta);
    return aiService.changeImageJobPriority(id, delta);
  });
  handle("ai:routes:list", (v) =>
    store.listGenerationRouteDecisions(projectIdSchema.parse(v).id),
  );
  handle("ai:asset-library:resolve", (v) =>
    aiService.resolveSafeAssetLibrary(safeAssetLibraryRequestSchema.parse(v)),
  );
  handle("ai:external-asset:preview", (v) =>
    aiService.previewExternalSafeAsset(safeAssetLibraryRequestSchema.parse(v)),
  );
  handle("ai:external-asset:enqueue", (v) =>
    aiService.confirmAndEnqueueExternalSafeAsset(
      externalDispatchConfirmationSchema.parse(v),
    ),
  );
  handle("ai:image:generate", (v) =>
    aiService.generateImage(imageJobRequestSchema.parse(v)),
  );
  handle("ai:image:enqueue-pages", (v) =>
    aiService.enqueuePageBatch(pageBatchImageRequestSchema.parse(v)),
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
      backgroundThrottling: !automatedRendererTest,
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
    let gpuInfo: unknown;
    try {
      gpuInfo = await app.getGPUInfo("complete");
    } catch (error) {
      diagnostics.log("warn", "runtime_gpu_detection_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    runtimeProfile = new RuntimeProfileService(
      path.join(desktopPaths().root, "runtime-profile.json"),
      hardwareFromElectronGpuInfo(os.totalmem(), gpuInfo),
    );
    const runtimeState = runtimeProfile.getState();
    diagnostics.log("info", "runtime_profile_detected", {
      totalRamBytes: runtimeState.hardware.totalRamBytes,
      dedicatedVramMb: runtimeState.hardware.dedicatedVramMb,
      recommendedProfile: runtimeState.recommendedProfile,
      effectiveProfile: runtimeState.effectiveProfile,
    });
    providerCredentials = new ProviderCredentialStore();
    dezgoFeatures = resolveDezgoFeatureFlags({ isPackaged: app.isPackaged });
    aiService = new AIService(store, {
      allowMock:
        !app.isPackaged || process.env.MANGAI_ENABLE_MOCK_AI === "true",
      getRuntimeProfile: () => runtimeProfile.getState(),
      getProviderCredential: (providerId) =>
        providerCredentials.get(providerId),
      dezgoFeatures,
    });
    updater = new DesktopUpdater(desktopPaths().root);
    register();
    aiService.resumeQueuedImages();
    const win = await createWindow();
    if (automatedRendererTest) {
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
      if (!rendererReady) throw new Error("Automated renderer test timed out.");
    }
    if (accessibilityTest) {
      const axePath = process.env.MANGAI_AXE_PATH,
        reportPath = process.env.MANGAI_A11Y_REPORT;
      if (!axePath || !path.isAbsolute(axePath) || !fs.existsSync(axePath))
        throw new Error("MANGAI_AXE_PATH must point to axe.min.js.");
      if (!reportPath || !path.isAbsolute(reportPath))
        throw new Error("MANGAI_A11Y_REPORT must be an absolute path.");
      const runtimeReportPath = process.env.MANGAI_A11Y_RUNTIME_REPORT;
      if (!runtimeReportPath || !path.isAbsolute(runtimeReportPath))
        throw new Error("MANGAI_A11Y_RUNTIME_REPORT must be an absolute path.");
      const accessibilityVariant = process.env.MANGAI_A11Y_VARIANT ?? "default";
      const runtimeReport = (await win.webContents.executeJavaScript(`({
        variant: ${JSON.stringify(accessibilityVariant)},
        devicePixelRatio: window.devicePixelRatio,
        forcedColorsActive: window.matchMedia("(forced-colors: active)").matches,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth
        }
      })`)) as {
        variant: string;
        devicePixelRatio: number;
        forcedColorsActive: boolean;
        viewport: { width: number; height: number };
        document: { clientWidth: number; scrollWidth: number };
      };
      if (
        accessibilityVariant === "scale-150" &&
        runtimeReport.devicePixelRatio < 1.49
      )
        throw new Error("150% display acceptance did not activate device scale 1.5.");
      if (
        accessibilityVariant === "high-contrast" &&
        !runtimeReport.forcedColorsActive
      )
        throw new Error("High contrast acceptance did not activate forced colors.");
      if (runtimeReport.document.scrollWidth > runtimeReport.document.clientWidth)
        throw new Error("Accessibility acceptance started with horizontal document overflow.");
      fs.writeFileSync(runtimeReportPath, JSON.stringify(runtimeReport, null, 2));
      const generationStateSeed = new Promise<boolean>((resolve) => {
        const deadline = Date.now() + 10_000;
        const timer = setInterval(() => {
          const project = store.listProjects()[0];
          if (!project) {
            if (Date.now() >= deadline) {
              clearInterval(timer);
              resolve(false);
            }
            return;
          }
          const projectBundle = store.bundle(project.id);
          if (!projectBundle.pages.length && projectBundle.episodes[0])
            store.addPage(projectBundle.episodes[0].id);
          const createJob = (
            status: "running" | "completed" | "failed",
            progress: number,
            errorMessage?: string,
          ) => {
            const id = store.createGenerationJob({
              projectId: project.id,
              providerType: "local",
              providerId: "comfyui",
              modelId: "accessibility-test",
              generationType: "image",
              prompt: `Accessibility ${status} state`,
              inputJson: {
                projectId: project.id,
                workflowId: "accessibility-test",
                prompt: `Accessibility ${status} state`,
              },
            });
            store.updateGenerationJob(id, status, {
              progress,
              errorCode: status === "failed" ? "A11Y_TEST_FAILURE" : undefined,
              errorMessage,
              output: status === "completed" ? { test: true } : undefined,
            });
          };
          createJob("running", 0.45);
          createJob("completed", 1);
          createJob("failed", 0.7, "ComfyUI生成に失敗しました。");
          const dezgoJobId = store.createGenerationJob({
            projectId: project.id,
            providerType: "cloud",
            providerId: "dezgo",
            modelId: "flux_1_schnell",
            generationType: "image",
            prompt: "Accessibility Dezgo completed state",
            inputJson: { test: true },
          });
          const dezgoSourceRelativePath = path.join(
            "generated",
            "accessibility-dezgo.png",
          );
          const dezgoSourcePath = path.join(
            project.storagePath,
            dezgoSourceRelativePath,
          );
          fs.mkdirSync(path.dirname(dezgoSourcePath), { recursive: true });
          fs.writeFileSync(
            dezgoSourcePath,
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
              "base64",
            ),
          );
          const dezgoAsset = store.registerGeneratedAsset(
            project.id,
            dezgoSourceRelativePath,
            dezgoJobId,
            { test: true },
          );
          store.updateGenerationJob(dezgoJobId, "completed", {
            progress: 1,
            output: {
              assetId: dezgoAsset.assetId,
              model: "flux_1_schnell",
              actualCostUsd: 0.0125,
              balanceUsd: 9.9875,
              responseSeed: 123456,
              durationMs: 2345,
              width: 768,
              height: 1024,
              steps: 20,
              sampler: "dpmpp_2m_karras",
            },
          });
          clearInterval(timer);
          resolve(true);
        }, 50);
      });
      await win.webContents.executeJavaScript(fs.readFileSync(axePath, "utf8"));
      const report = (await win.webContents.executeJavaScript(`
        (async () => {
          const waitFor = (selector) =>
            new Promise((resolve, reject) => {
              const deadline = Date.now() + 10000;
              const check = () => {
                const element = document.querySelector(selector);
                if (element) return resolve(element);
                if (Date.now() >= deadline)
                  return reject(new Error("Timed out waiting for " + selector));
                setTimeout(check, 50);
              };
              check();
            });
          const waitForMissing = (selector) =>
            new Promise((resolve, reject) => {
              const deadline = Date.now() + 10000;
              const check = () => {
                if (!document.querySelector(selector)) return resolve(true);
                if (Date.now() >= deadline)
                  return reject(
                    new Error("Timed out waiting to remove " + selector),
                  );
                setTimeout(check, 50);
              };
              check();
            });
          const settle = () =>
            new Promise((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => setTimeout(resolve, 150)),
              ),
            );
          const audit = async (screen) => {
            await settle();
            const result = await axe.run(document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
              }
            });
            return {
              screen,
              url: location.href,
              violations: result.violations,
              incomplete: result.incomplete,
              passes: result.passes.length
            };
          };
          const screens = [await audit("home")];
          document
            .querySelector('[data-a11y-action="new-project"]')
            .click();
          const title = await waitFor('[data-a11y-field="project-title"]');
          screens.push(await audit("new-project-dialog"));
          const valueSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          ).set;
          const selectValueSetter = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            "value",
          ).set;
          valueSetter.call(title, "Accessibility Test Project");
          title.dispatchEvent(new Event("input", { bubbles: true }));
          document.querySelector('form[role="dialog"]').requestSubmit();
          await waitFor('[data-workspace-view="editor"]');
          screens.push(await audit("editor"));
          document
            .querySelector('[data-a11y-action="open-generation-drawer"]')
            .click();
          await waitFor('.generation-drawer[role="dialog"]');
          await waitFor(
            '.generation-drawer [data-generation-status="running"]',
          );
          await waitFor(
            '.generation-drawer [data-generation-status="completed"]',
          );
          await waitFor(
            '.generation-drawer [data-generation-status="failed"]',
          );
          screens.push(await audit("generation-drawer"));
          document.querySelector('[data-generation-close]').click();
          await waitForMissing('.generation-drawer[role="dialog"]');
          document.querySelector('[data-a11y-action="open-projects"]').click();
          const projectButton = await waitFor('.project-open');
          projectButton.click();
          await waitFor('.manga-canvas-shell');
          screens.push(await audit("editor-page"));
          const headerMenu = document.querySelector(
            '[data-a11y-menu="header-more"]',
          );
          headerMenu.querySelector("summary").click();
          await waitFor('[data-a11y-menu="header-more"][open]');
          screens.push(await audit("header-more-menu"));
          headerMenu.open = false;
          for (const menu of ["add", "layout", "view"]) {
            const details = document.querySelector(
              '[data-a11y-menu="' + menu + '"]',
            );
            details.querySelector("summary").click();
            await waitFor(
              '[data-a11y-menu="' + menu + '"][open]',
            );
            screens.push(await audit("canvas-" + menu + "-menu"));
            details.open = false;
          }
          document.querySelector('[data-a11y-action="open-export"]').click();
          await waitFor('.export-dialog[role="dialog"]');
          screens.push(await audit("export-dialog"));
          document.querySelector('[data-a11y-action="close-export"]').click();
          await waitForMissing('.export-dialog[role="dialog"]');
          await waitFor('[data-workspace-view="editor"][aria-current="page"]');
          for (const view of ["chat", "jobs", "hub"]) {
            document.querySelector(
              '[data-workspace-view="' + view + '"]',
            ).click();
            await waitFor(
              '[data-workspace-view="' + view + '"][aria-current="page"]',
            );
            if (view === "jobs") {
              await waitFor('[data-generation-status="running"]');
              await waitFor('[data-generation-status="completed"]');
              await waitFor('[data-generation-status="failed"]');
              const dezgoResult = await waitFor(
                '[data-generation-provider="dezgo"]',
              );
              if (dezgoResult.querySelector("button")?.disabled)
                throw new Error("Dezgo saved asset action is disabled.");
            }
            screens.push(await audit(view));
          }
          const hubUrl = await waitFor('[data-a11y-field="hub-url"]');
          valueSetter.call(hubUrl, "http://example.com");
          hubUrl.dispatchEvent(new Event("input", { bubbles: true }));
          document.querySelector('[data-a11y-action="check-hub"]').click();
          await waitFor('[role="alert"]');
          screens.push(await audit("hub-error"));
          document
            .querySelector('[data-workspace-view="settings"]')
            .click();
          await waitFor(
            '[data-workspace-view="settings"][aria-current="page"]',
          );
          screens.push(await audit("settings"));
          const localeSelect = await waitFor('[data-a11y-field="locale"]');
          selectValueSetter.call(localeSelect, "en");
          localeSelect.dispatchEvent(new Event("change", { bubbles: true }));
          await waitFor('html[lang="en"]');
          screens.push(await audit("settings-en"));
          document
            .querySelector('[data-workspace-view="hub"]')
            .click();
          await waitFor(
            '[data-workspace-view="hub"][aria-current="page"]',
          );
          screens.push(await audit("hub-en"));
          const englishHubUrl = await waitFor(
            '[data-a11y-field="hub-url"]',
          );
          valueSetter.call(englishHubUrl, "http://example.com");
          englishHubUrl.dispatchEvent(new Event("input", { bubbles: true }));
          document.querySelector('[data-a11y-action="check-hub"]').click();
          await waitFor('[role="alert"]');
          screens.push(await audit("hub-error-en"));
          const englishAlert = document.querySelector('[role="alert"]');
          if (/[\u3040-\u30ff\u3400-\u9fff]/.test(englishAlert.textContent))
            throw new Error(
              "English Hub error still contains Japanese text.",
            );
          for (const view of ["jobs", "chat", "editor"]) {
            document.querySelector(
              '[data-workspace-view="' + view + '"]',
            ).click();
            await waitFor(
              '[data-workspace-view="' + view + '"][aria-current="page"]',
            );
            if (view === "jobs") {
              await waitFor('[data-generation-status="running"]');
              await waitFor('[data-generation-status="completed"]');
              await waitFor('[data-generation-status="failed"]');
              const dezgoResult = await waitFor(
                '[data-generation-provider="dezgo"]',
              );
              if (dezgoResult.querySelector("button")?.disabled)
                throw new Error("Dezgo saved asset action is disabled.");
              const failedMessage = document.querySelector(
                '[data-generation-status="failed"] [role="alert"]',
              );
              if (
                /[\u3040-\u30ff\u3400-\u9fff]/.test(
                  failedMessage.textContent,
                )
              )
                throw new Error(
                  "English generation error still contains Japanese text.",
                );
            }
            screens.push(
              await audit(view === "editor" ? "editor-page-en" : view + "-en"),
            );
          }
          const englishHeaderMenu = document.querySelector(
            '[data-a11y-menu="header-more"]',
          );
          englishHeaderMenu.querySelector("summary").click();
          await waitFor('[data-a11y-menu="header-more"][open]');
          screens.push(await audit("header-more-menu-en"));
          englishHeaderMenu.open = false;
          for (const menu of ["add", "layout", "view"]) {
            const details = document.querySelector(
              '[data-a11y-menu="' + menu + '"]',
            );
            details.querySelector("summary").click();
            await waitFor(
              '[data-a11y-menu="' + menu + '"][open]',
            );
            screens.push(await audit("canvas-" + menu + "-menu-en"));
            details.open = false;
          }
          document
            .querySelector('[data-a11y-action="open-generation-drawer"]')
            .click();
          await waitFor('.generation-drawer[role="dialog"]');
          await waitFor(
            '.generation-drawer [data-generation-status="running"]',
          );
          await waitFor(
            '.generation-drawer [data-generation-status="completed"]',
          );
          await waitFor(
            '.generation-drawer [data-generation-status="failed"]',
          );
          screens.push(await audit("generation-drawer-en"));
          document.querySelector('[data-generation-close]').click();
          await waitForMissing('.generation-drawer[role="dialog"]');
          document.querySelector('[data-a11y-action="open-export"]').click();
          await waitFor('.export-dialog[role="dialog"]');
          screens.push(await audit("export-dialog-en"));
          document.querySelector('[data-a11y-action="close-export"]').click();
          await waitForMissing('.export-dialog[role="dialog"]');
          document.querySelector('[data-a11y-action="open-projects"]').click();
          await waitFor('[data-a11y-action="new-project"]');
          screens.push(await audit("home-en"));
          document
            .querySelector('[data-a11y-action="new-project"]')
            .click();
          await waitFor('[data-a11y-field="project-title"]');
          screens.push(await audit("new-project-dialog-en"));
          return {
            checkedAt: new Date().toISOString(),
            screens,
          };
        })()
      `)) as {
        screens: Array<{
          screen: string;
          violations: Array<{ impact?: string | null; id: string }>;
        }>;
      };
      if (!(await generationStateSeed))
        throw new Error("Accessibility generation states were not seeded.");
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      // Phase D3-C準備: コマンドパレットの目視確認基盤。
      // 既存のaxe監査（上記）とは別に、Electron組み込みのcapturePage()でスクリーンショットを
      // artifactとして保存し、開閉・ショートカット・キーボード操作・安全境界を機械的に検証する。
      // 新規npm依存パッケージは追加していない。
      type VisualCheck = {
        id: string;
        label: string;
        pass: boolean;
        detail?: string;
      };
      const visualChecks: VisualCheck[] = [];
      const screenshotDir = path.join(path.dirname(reportPath), "screenshots");
      fs.mkdirSync(screenshotDir, { recursive: true });
      const captureScreenshot = async (name: string) => {
        try {
          const image = await win.webContents.capturePage();
          fs.writeFileSync(path.join(screenshotDir, `${name}.png`), image.toPNG());
        } catch (cause) {
          visualChecks.push({
            id: `screenshot-${name}`,
            label: `スクリーンショット取得: ${name}`,
            pass: false,
            detail: cause instanceof Error ? cause.message : String(cause),
          });
        }
      };
      const checkStep = async (
        id: string,
        label: string,
        run: () => Promise<{ pass: boolean; detail?: string }>,
      ) => {
        try {
          const { pass, detail } = await run();
          visualChecks.push({ id, label, pass, detail });
        } catch (cause) {
          visualChecks.push({
            id,
            label,
            pass: false,
            detail: cause instanceof Error ? cause.message : String(cause),
          });
        }
      };
      const evalPage = <T,>(script: string) =>
        win.webContents.executeJavaScript(script) as Promise<T>;

      await checkStep(
        "close-new-project-dialog",
        "新規Projectダイアログを閉じて既知の状態へ戻す",
        async () => {
          const closed = await evalPage<boolean>(`
            (async () => {
              const cancel = document.querySelector('form[role="dialog"] footer button[type="button"]');
              if (cancel) cancel.click();
              const deadline = Date.now() + 5000;
              while (document.querySelector('form[role="dialog"]')) {
                if (Date.now() >= deadline) return false;
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              return true;
            })()
          `);
          return { pass: closed, detail: closed ? undefined : "dialog did not close" };
        },
      );

      // 既存のaxe監査IIFEが処理の途中でロケールを英語へ切り替え、以降は戻さない仕様のため、
      // このブロック以降のスクリーンショットは実際の日本語UIで撮影されるようロケールを戻す。
      await checkStep(
        "restore-japanese-locale",
        "スクリーンショットを実際の日本語UIで撮影するため、ロケールを日本語へ戻す",
        async () => {
          const result = await evalPage<{ restored: boolean }>(`
            (async () => {
              const select = document.querySelector('[data-a11y-field="locale"]');
              if (!select) return { restored: false };
              const setter = Object.getOwnPropertyDescriptor(
                HTMLSelectElement.prototype,
                "value",
              ).set;
              setter.call(select, "ja");
              select.dispatchEvent(new Event("change", { bubbles: true }));
              const deadline = Date.now() + 5000;
              while (document.documentElement.lang !== "ja") {
                if (Date.now() >= deadline) return { restored: false };
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              return { restored: true };
            })()
          `);
          return {
            pass: result.restored,
            detail: result.restored ? undefined : "locale did not switch back to ja",
          };
        },
      );
      await captureScreenshot("home-before-command-palette");

      // Phase D3-C: Home画面Projectカードグリッドの目視確認。
      await checkStep(
        "home-project-grid-rendered",
        "Projectカードグリッドがカバー画像・作品名・状態Badgeとともに描画される",
        async () => {
          const result = await evalPage<{
            cardCount: number;
            hasTitle: boolean;
            hasBadge: boolean;
          }>(`
            (() => {
              const grid = document.querySelector('.home-project-grid');
              const cards = grid ? grid.querySelectorAll('.home-project-card') : [];
              const firstCard = cards[0];
              return {
                cardCount: cards.length,
                hasTitle: Boolean(
                  firstCard &&
                    firstCard.querySelector('.project-summary strong')?.textContent ===
                      'Accessibility Test Project',
                ),
                hasBadge: Boolean(
                  firstCard && firstCard.querySelector('.status-badge'),
                ),
              };
            })()
          `);
          return {
            pass: result.cardCount > 0 && result.hasTitle && result.hasBadge,
            detail: `cardCount=${result.cardCount} hasTitle=${result.hasTitle} hasBadge=${result.hasBadge}`,
          };
        },
      );
      await captureScreenshot("home-project-grid-populated");

      // 責任者レビュー指摘: Projectが1件のときカードが画面全幅まで拡大し、
      // 作品名・Badge・操作ボタンが初期表示の下へ押し出される不具合の回帰確認。
      await checkStep(
        "home-project-card-max-width-single-project",
        "Projectが1件のときカード幅が過度に拡大せず（320px以下）、作品名・操作領域がhover等に依存せず描画されている",
        async () => {
          // 「初期表示内（スクロール不要）に収まる」という厳密な要求は、
          // 指示書が明示する2解像度（1920x1080/1366x768）専用のチェックで別途確認する。
          // ここではデフォルトのdev window sizeに依存しないよう、非表示(display:none等)
          // になっていないことのみを確認する。
          const result = await evalPage<{
            cardWidth: number;
            titleVisible: boolean;
            actionsVisible: boolean;
          }>(`
            (() => {
              const card = document.querySelector('.home-project-card');
              if (!card) {
                return { cardWidth: 0, titleVisible: false, actionsVisible: false };
              }
              const isRendered = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
              };
              return {
                cardWidth: card.getBoundingClientRect().width,
                titleVisible: isRendered(card.querySelector('.project-summary strong')),
                actionsVisible: isRendered(card.querySelector('.home-project-card-actions')),
              };
            })()
          `);
          return {
            pass: result.cardWidth > 0 && result.cardWidth <= 320 && result.titleVisible && result.actionsVisible,
            detail: `cardWidth=${Math.round(result.cardWidth)} titleVisible=${result.titleVisible} actionsVisible=${result.actionsVisible}`,
          };
        },
      );

      // フィルタchipはfilterHomeProjectsと同じ["all","general","adult"]の順で
      // 描画される（HomeProjectFilters.tsxのFILTERS配列）ため、文言（ja/en）に
      // 依存せず位置で選択する。
      await checkStep(
        "home-project-filter-updates-grid",
        "成人向けフィルタへ切り替えると、一般Projectのみの一覧では0件表示になる",
        async () => {
          const result = await evalPage<{
            filteredCount: number;
            showsEmptyMessage: boolean;
          }>(`
            (async () => {
              const chips = document.querySelectorAll('.home-filter-chip');
              const adultChip = chips[2];
              if (!adultChip) throw new Error('adult filter chip not found');
              adultChip.click();
              await new Promise((resolve) => setTimeout(resolve, 150));
              return {
                filteredCount: document.querySelectorAll('.home-project-card').length,
                showsEmptyMessage: Boolean(document.querySelector('.home-project-empty')),
              };
            })()
          `);
          return {
            pass: result.filteredCount === 0 && result.showsEmptyMessage,
            detail: `filteredCount=${result.filteredCount} showsEmptyMessage=${result.showsEmptyMessage}`,
          };
        },
      );
      await captureScreenshot("home-project-grid-filtered-empty");

      await checkStep(
        "home-project-filter-restores-grid",
        "「すべて」へ戻すとフィルタ前の件数に復帰する",
        async () => {
          const restoredCount = await evalPage<number>(`
            (async () => {
              const chips = document.querySelectorAll('.home-filter-chip');
              const allChip = chips[0];
              if (!allChip) throw new Error('all filter chip not found');
              allChip.click();
              await new Promise((resolve) => setTimeout(resolve, 150));
              return document.querySelectorAll('.home-project-card').length;
            })()
          `);
          return {
            pass: restoredCount > 0,
            detail: `restoredCount=${restoredCount}`,
          };
        },
      );

      // 指示書が明示する2解像度（DESKTOP_CREATIVE_STUDIO_SPEC.md §4.1）でのグリッド確認。
      // Projectが1件の状態（責任者が不具合を発見した状態そのもの）で、カード幅・
      // 左寄せ・タイトル/操作領域の可視性を解像度ごとに確認する。
      const defaultContentSize = win.getContentSize();
      for (const [label, width, height] of [
        ["1920x1080", 1920, 1080],
        ["1366x768", 1366, 768],
      ] as const) {
        win.setContentSize(width, height);
        await new Promise((resolve) => setTimeout(resolve, 150));
        await checkStep(
          `home-project-grid-layout-${label}`,
          `${label}でカードが左寄せの適切な幅になり、作品名・操作領域が初期表示内に収まる`,
          async () => {
            const result = await evalPage<{
              cardWidth: number;
              leftOffset: number;
              titleVisible: boolean;
              actionsVisible: boolean;
            }>(`
              (() => {
                const grid = document.querySelector('.home-project-grid');
                const card = document.querySelector('.home-project-card');
                if (!grid || !card) {
                  return { cardWidth: 0, leftOffset: 9999, titleVisible: false, actionsVisible: false };
                }
                const gridRect = grid.getBoundingClientRect();
                const cardRect = card.getBoundingClientRect();
                const inViewport = (el) => {
                  if (!el) return false;
                  const rect = el.getBoundingClientRect();
                  return rect.width > 0 && rect.bottom > 0 && rect.bottom <= window.innerHeight;
                };
                return {
                  cardWidth: cardRect.width,
                  leftOffset: cardRect.left - gridRect.left,
                  titleVisible: inViewport(card.querySelector('.project-summary strong')),
                  actionsVisible: inViewport(card.querySelector('.home-project-card-actions')),
                };
              })()
            `);
            const leftAligned = result.leftOffset >= 0 && result.leftOffset < 4;
            return {
              pass:
                result.cardWidth > 0 &&
                result.cardWidth <= 320 &&
                leftAligned &&
                result.titleVisible &&
                result.actionsVisible,
              detail: `cardWidth=${Math.round(result.cardWidth)} leftOffset=${Math.round(result.leftOffset)} titleVisible=${result.titleVisible} actionsVisible=${result.actionsVisible}`,
            };
          },
        );
        await captureScreenshot(`home-project-grid-${label}`);
      }
      win.setContentSize(defaultContentSize[0], defaultContentSize[1]);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const TRIGGER_SELECTOR = '[aria-label="コマンドパレットを開く (Ctrl+K)"]';
      const DIALOG_SELECTOR = '.ds-command-palette[role="dialog"]';
      const INPUT_SELECTOR = '.ds-command-palette-input';

      await checkStep(
        "open-via-button",
        "Home画面のボタンから開く（検索入力への自動フォーカスを含む）",
        async () => {
          const result = await evalPage<{ opened: boolean; focused: boolean }>(`
            (async () => {
              document.querySelector('${TRIGGER_SELECTOR}').click();
              const deadline = Date.now() + 3000;
              while (!document.querySelector('${DIALOG_SELECTOR}')) {
                if (Date.now() >= deadline) return { opened: false, focused: false };
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              await new Promise((resolve) => setTimeout(resolve, 100));
              const input = document.querySelector('${INPUT_SELECTOR}');
              return { opened: true, focused: document.activeElement === input };
            })()
          `);
          return {
            pass: result.opened && result.focused,
            detail: `opened=${result.opened} focused=${result.focused}`,
          };
        },
      );
      await checkStep(
        "no-forbidden-commands-rendered",
        "AI Provider有効化・成人向け生成・APIキー変更・課金操作のコマンドが描画されていない",
        async () => {
          const forbidden = await evalPage<string[]>(`
            (() => {
              const forbiddenPattern = /provider.*有効化|成人向け.*(生成|実行)|api\\s*key|apiキー|stripe|checkout|課金|削除|一括削除/i;
              return Array.from(document.querySelectorAll('.ds-command-palette-row-label'))
                .map((el) => el.textContent || "")
                .filter((label) => forbiddenPattern.test(label));
            })()
          `);
          return {
            pass: forbidden.length === 0,
            detail: forbidden.length ? forbidden.join(", ") : undefined,
          };
        },
      );
      await captureScreenshot("command-palette-open-button");

      await checkStep(
        "toggle-close-via-button",
        "起動ボタンを再操作すると閉じる（トグル）",
        async () => {
          const closed = await evalPage<boolean>(`
            (async () => {
              document.querySelector('${TRIGGER_SELECTOR}').click();
              const deadline = Date.now() + 3000;
              while (document.querySelector('${DIALOG_SELECTOR}')) {
                if (Date.now() >= deadline) return false;
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              return true;
            })()
          `);
          return { pass: closed, detail: closed ? undefined : "did not close on toggle" };
        },
      );
      await captureScreenshot("command-palette-closed-toggle");

      await checkStep("open-via-ctrl-k", "Ctrl+Kから開く", async () => {
        const opened = await evalPage<boolean>(`
          (async () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
            const deadline = Date.now() + 3000;
            while (!document.querySelector('${DIALOG_SELECTOR}')) {
              if (Date.now() >= deadline) return false;
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            return true;
          })()
        `);
        return { pass: opened, detail: opened ? undefined : "did not open via Ctrl+K" };
      });
      await captureScreenshot("command-palette-open-ctrlk");

      await checkStep("close-via-escape", "Escapeで閉じる", async () => {
        const closed = await evalPage<boolean>(`
          (async () => {
            const input = document.querySelector('${INPUT_SELECTOR}');
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
            const deadline = Date.now() + 3000;
            while (document.querySelector('${DIALOG_SELECTOR}')) {
              if (Date.now() >= deadline) return false;
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            return true;
          })()
        `);
        return { pass: closed, detail: closed ? undefined : "did not close on Escape" };
      });
      await captureScreenshot("command-palette-closed-escape");

      await checkStep(
        "arrow-key-navigation",
        "上下キーで選択移動できる",
        async () => {
          const result = await evalPage<{ before: string | null; after: string | null }>(`
            (async () => {
              document.querySelector('${TRIGGER_SELECTOR}').click();
              const deadline = Date.now() + 3000;
              while (!document.querySelector('${DIALOG_SELECTOR}')) {
                if (Date.now() >= deadline) throw new Error("palette did not reopen");
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              const before = document.querySelector('.ds-command-palette-row-active')?.id || null;
              const input = document.querySelector('${INPUT_SELECTOR}');
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
              await new Promise((resolve) => setTimeout(resolve, 150));
              const after = document.querySelector('.ds-command-palette-row-active')?.id || null;
              // Ctrl+K only ever opens (never toggles), so leaving the palette open here
              // would make the next open a no-op that keeps this stale activeIndex.
              // Close it now so later steps reliably start from a fresh activeIndex=0.
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
              const closeDeadline = Date.now() + 3000;
              while (document.querySelector('${DIALOG_SELECTOR}')) {
                if (Date.now() >= closeDeadline) break;
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              return { before, after };
            })()
          `);
          return {
            pass: Boolean(result.before) && Boolean(result.after) && result.before !== result.after,
            detail: `before=${result.before} after=${result.after}`,
          };
        },
      );
      await captureScreenshot("command-palette-arrow-selection");

      await checkStep(
        "enter-executes-and-restores-focus",
        "Enterでコマンドを実行でき、閉じた後に起動元へフォーカスが戻る",
        async () => {
          const result = await evalPage<{
            activeId: string | null;
            closed: boolean;
            focusReturned: boolean;
          }>(`
            (async () => {
              // previouslyFocused内でdocument.activeElementを基準にするため、
              // 直前のステップの残存フォーカス状態に依存せず、ここで明示的に
              // トリガーボタンへフォーカスしてから開く（前提条件を自己完結させる）。
              const trigger = document.querySelector('${TRIGGER_SELECTOR}');
              trigger.focus();
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
              const openDeadline = Date.now() + 3000;
              while (!document.querySelector('${DIALOG_SELECTOR}')) {
                if (Date.now() >= openDeadline) throw new Error("palette did not reopen");
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              const activeRow = document.querySelector('.ds-command-palette-row-active');
              const activeId = activeRow ? activeRow.id : null;
              const input = document.querySelector('${INPUT_SELECTOR}');
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
              const closeDeadline = Date.now() + 3000;
              while (document.querySelector('${DIALOG_SELECTOR}')) {
                if (Date.now() >= closeDeadline) return { activeId, closed: false, focusReturned: false };
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              await new Promise((resolve) => setTimeout(resolve, 100));
              return { activeId, closed: true, focusReturned: document.activeElement === trigger };
            })()
          `);
          return {
            pass:
              Boolean(result.activeId?.endsWith("-option-nav-home")) &&
              result.closed &&
              result.focusReturned,
            detail: `activeId=${result.activeId} closed=${result.closed} focusReturned=${result.focusReturned}`,
          };
        },
      );
      await captureScreenshot("command-palette-after-select");

      await checkStep(
        "disabled-while-modal-open",
        "既存モーダル操作中はCtrl+Kが奪われない（新規Projectダイアログとの共存）",
        async () => {
          const result = await evalPage<{ dialogOpened: boolean; paletteStayedClosed: boolean }>(`
            (async () => {
              document.querySelector('[data-a11y-action="new-project"]').click();
              const deadline = Date.now() + 3000;
              while (!document.querySelector('form[role="dialog"]')) {
                if (Date.now() >= deadline) return { dialogOpened: false, paletteStayedClosed: false };
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
              await new Promise((resolve) => setTimeout(resolve, 300));
              const paletteStayedClosed = !document.querySelector('${DIALOG_SELECTOR}');
              const cancel = document.querySelector('form[role="dialog"] footer button[type="button"]');
              if (cancel) cancel.click();
              const closeDeadline = Date.now() + 3000;
              while (document.querySelector('form[role="dialog"]')) {
                if (Date.now() >= closeDeadline) break;
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              return { dialogOpened: true, paletteStayedClosed };
            })()
          `);
          return {
            pass: result.dialogOpened && result.paletteStayedClosed,
            detail: `dialogOpened=${result.dialogOpened} paletteStayedClosed=${result.paletteStayedClosed}`,
          };
        },
      );

      await checkStep(
        "open-project-from-recent",
        "コマンドパレットから最近開いたProjectを開ける",
        async () => {
          const result = await evalPage<{ found: boolean; entered: boolean }>(`
            (async () => {
              document.querySelector('${TRIGGER_SELECTOR}').click();
              const openDeadline = Date.now() + 3000;
              while (!document.querySelector('${DIALOG_SELECTOR}')) {
                if (Date.now() >= openDeadline) throw new Error("palette did not open");
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              const rows = Array.from(document.querySelectorAll('.ds-command-palette-row'));
              const recentRow = rows.find((row) => {
                const label = row.querySelector('.ds-command-palette-row-label');
                return label && label.textContent === 'Accessibility Test Project';
              });
              if (!recentRow) return { found: false, entered: false };
              recentRow.click();
              const enterDeadline = Date.now() + 5000;
              while (!document.querySelector('.manga-canvas-shell')) {
                if (Date.now() >= enterDeadline) return { found: true, entered: false };
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              return { found: true, entered: true };
            })()
          `);
          return {
            pass: result.found && result.entered,
            detail: `found=${result.found} entered=${result.entered}`,
          };
        },
      );
      await captureScreenshot("command-palette-project-opened");

      await checkStep(
        "navigate-to-settings",
        "コマンドパレットから設定画面へ移動できる",
        async () => {
          const result = await evalPage<boolean>(`
            (async () => {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
              const openDeadline = Date.now() + 3000;
              while (!document.querySelector('${DIALOG_SELECTOR}')) {
                if (Date.now() >= openDeadline) return false;
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              const rows = Array.from(document.querySelectorAll('[role="option"]'));
              const settingsRow = rows.find((row) => row.id.endsWith('-option-nav-settings'));
              if (!settingsRow) return false;
              settingsRow.click();
              const deadline = Date.now() + 3000;
              while (!document.querySelector('[data-workspace-view="settings"][aria-current="page"]')) {
                if (Date.now() >= deadline) return false;
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              return true;
            })()
          `);
          return { pass: result, detail: result ? undefined : "settings view not reached" };
        },
      );
      await captureScreenshot("command-palette-settings-open");

      // 責任者レビュー指摘: 複数Project時（4件・10件以上・長いタイトル・一般／成人向け
      // 混在）でカードグリッドが崩れないことを確認する。既存の「新規Project」ダイアログ
      // UI操作（createProject IPC）のみを使用し、新規IPCは追加していない。
      // このブロックはコマンドパレットの全検証（特に「最近開いたProject」を検索する
      // open-project-from-recent）より後に置く。先にProjectを増やすと"Accessibility
      // Test Project"が最近開いた一覧から押し出され、後続チェックが連鎖的に失敗するため。
      await checkStep(
        "return-home-before-seeding",
        "設定画面からHomeへ戻り、Project追加の準備をする",
        async () => {
          const result = await evalPage<boolean>(`
            (async () => {
              document.querySelector('[data-a11y-action="open-projects"]').click();
              const deadline = Date.now() + 5000;
              while (!document.querySelector('[data-a11y-action="new-project"]')) {
                if (Date.now() >= deadline) return false;
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              return true;
            })()
          `);
          return { pass: result, detail: result ? undefined : "did not return to home" };
        },
      );

      const createProjectViaDialog = async (title: string) => {
        await evalPage<void>(`
          (async () => {
            document.querySelector('[data-a11y-action="new-project"]').click();
            const fieldDeadline = Date.now() + 3000;
            while (!document.querySelector('[data-a11y-field="project-title"]')) {
              if (Date.now() >= fieldDeadline) throw new Error('project-title field not found');
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            const titleField = document.querySelector('[data-a11y-field="project-title"]');
            const valueSetter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value",
            ).set;
            valueSetter.call(titleField, ${JSON.stringify(title)});
            titleField.dispatchEvent(new Event("input", { bubbles: true }));
            document.querySelector('form[role="dialog"]').requestSubmit();
            const editorDeadline = Date.now() + 5000;
            while (!document.querySelector('[data-a11y-action="open-projects"]')) {
              if (Date.now() >= editorDeadline) throw new Error('did not enter editor after create');
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            document.querySelector('[data-a11y-action="open-projects"]').click();
            const homeDeadline = Date.now() + 5000;
            while (!document.querySelector('[data-a11y-action="new-project"]')) {
              if (Date.now() >= homeDeadline) throw new Error('did not return to home after create');
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          })()
        `);
      };

      await checkStep(
        "home-project-grid-scales-to-4-projects",
        "Projectが4件のとき、カードグリッドが複数列で崩れず描画される",
        async () => {
          for (const title of ["第二作品", "第三作品", "第四作品"]) {
            await createProjectViaDialog(title);
          }
          const result = await evalPage<{ cardCount: number; anyOversized: boolean }>(`
            (() => {
              const cards = Array.from(document.querySelectorAll('.home-project-card'));
              return {
                cardCount: cards.length,
                anyOversized: cards.some((card) => card.getBoundingClientRect().width > 320),
              };
            })()
          `);
          return {
            pass: result.cardCount === 4 && !result.anyOversized,
            detail: `cardCount=${result.cardCount} anyOversized=${result.anyOversized}`,
          };
        },
      );
      await captureScreenshot("home-project-grid-4-projects");

      const LONG_TITLE =
        "非常に長い作品タイトルの表示崩れを確認するためのテスト用プロジェクト名（省略記号が正しく機能することを確認する）";
      await checkStep(
        "home-project-grid-scales-to-10-projects",
        "Projectが10件以上（長いタイトル・一般／成人向け混在含む）でもカードグリッドが崩れない",
        async () => {
          for (const title of ["第五作品", "第六作品", "第七作品", "第八作品", "第九作品", LONG_TITLE]) {
            await createProjectViaDialog(title);
          }
          await evalPage<void>(`
            (() => {
              window.confirm = () => true;
              window.alert = () => {};
            })()
          `);
          const moved = await evalPage<boolean>(`
            (async () => {
              const cards = Array.from(document.querySelectorAll('.home-project-card'));
              const targetCard = cards.find((card) =>
                (card.querySelector('.project-summary strong')?.textContent || '').startsWith(${JSON.stringify(LONG_TITLE.slice(0, 12))}),
              );
              if (!targetCard) return false;
              const moveButton = Array.from(targetCard.querySelectorAll('button')).find((b) =>
                /成人向け|adult/i.test(b.textContent || ''),
              );
              if (!moveButton) return false;
              moveButton.click();
              const deadline = Date.now() + 5000;
              while (Date.now() < deadline) {
                const badge = targetCard.querySelector('.status-badge');
                if (badge && /成人向け|adult/i.test(badge.textContent || '')) return true;
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              return false;
            })()
          `);
          const result = await evalPage<{
            cardCount: number;
            anyOversized: boolean;
            longTitleEllipsized: boolean;
            adultBadgeCount: number;
          }>(`
            (() => {
              const cards = Array.from(document.querySelectorAll('.home-project-card'));
              const longTitleCard = cards.find((card) =>
                (card.querySelector('.project-summary strong')?.textContent || '').startsWith(${JSON.stringify(LONG_TITLE.slice(0, 12))}),
              );
              const strongEl = longTitleCard && longTitleCard.querySelector('.project-summary strong');
              return {
                cardCount: cards.length,
                anyOversized: cards.some((card) => card.getBoundingClientRect().width > 320),
                longTitleEllipsized: Boolean(strongEl && strongEl.scrollWidth > strongEl.clientWidth),
                adultBadgeCount: cards.filter((card) =>
                  Array.from(card.querySelectorAll('.status-badge')).some((badge) =>
                    /成人向け|adult/i.test(badge.textContent || ''),
                  ),
                ).length,
              };
            })()
          `);
          return {
            pass:
              result.cardCount >= 10 &&
              !result.anyOversized &&
              result.longTitleEllipsized &&
              moved &&
              result.adultBadgeCount >= 1,
            detail: `cardCount=${result.cardCount} anyOversized=${result.anyOversized} longTitleEllipsized=${result.longTitleEllipsized} moved=${moved} adultBadgeCount=${result.adultBadgeCount}`,
          };
        },
      );
      await captureScreenshot("home-project-grid-10-projects");

      const visualReportPath = path.join(
        path.dirname(reportPath),
        "command-palette-visual.json",
      );
      fs.writeFileSync(
        visualReportPath,
        JSON.stringify({ checkedAt: new Date().toISOString(), checks: visualChecks }, null, 2),
      );
      const failedVisualChecks = visualChecks.filter((check) => !check.pass);
      if (failedVisualChecks.length)
        process.stderr.write(
          `Command palette visual checks failed: ${failedVisualChecks
            .map((check) => `${check.id}(${check.detail ?? "no detail"})`)
            .join(", ")}\n`,
        );

      const blocking = report.screens.flatMap((screen) =>
        screen.violations
          .filter((item) =>
            ["serious", "critical"].includes(String(item.impact)),
          )
          .map((item) => `${screen.screen}:${item.id}`),
      );
      if (blocking.length)
        throw new Error(`Accessibility audit failed: ${blocking.join(", ")}`);
      if (failedVisualChecks.length)
        throw new Error(
          `Command palette visual validation failed: ${failedVisualChecks
            .map((check) => check.id)
            .join(", ")}`,
        );
      app.quit();
      return;
    }
    if (smokeTest) {
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
    if (automatedRendererTest) {
      diagnostics?.captureCrash(
        accessibilityTest ? "accessibility_test.failed" : "smoke_test.failed",
        cause,
      );
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
  adultPilotRuntimeSupervisor.stop();
  if (autoBackupTimer) clearInterval(autoBackupTimer);
  store?.close();
});

export { desktopPaths };
