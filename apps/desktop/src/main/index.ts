import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MangaiDatabase } from "./database.js";
import { AIService } from "./ai/service.js";
import {
  assetIdSchema,
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
} from "@mangai/shared";
import {
  cancelRequestSchema,
  chatRequestSchema,
  chatSessionIdSchema,
  imageJobRequestSchema,
  promptTemplateInputSchema,
  providerSettingsSchema,
  renameChatSchema,
  workflowMappingSchema,
  workflowUpdateSchema,
} from "@mangai/ai-core";

const here = path.dirname(fileURLToPath(import.meta.url));
let store: MangaiDatabase;
let aiService: AIService;
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
      throw new Error(message);
    }
  });
}
function register() {
  handle("app:paths", () => desktopPaths());
  handle("projects:list", () => store.listProjects());
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
    return store.renameProject(x.id, x.title);
  });
  handle("projects:duplicate", (v) =>
    store.duplicateProject(projectIdSchema.parse(v).id),
  );
  handle("projects:delete", (v) =>
    store.deleteProject(projectIdSchema.parse(v).id),
  );
  handle("projects:export", (v) =>
    store.exportProject(projectIdSchema.parse(v).id),
  );
  handle("episodes:create", (v) => {
    const x = episodeInputSchema.parse(v);
    return store.createEpisode(x.projectId, x.title);
  });
  handle("episodes:rename", (v) => {
    const x = renameEpisodeSchema.parse(v);
    return store.renameEpisode(x.id, x.title);
  });
  handle("episodes:reorder", (v) => {
    const x = reorderEpisodesSchema.parse(v);
    return store.reorderEpisodes(x.projectId, x.episodeIds);
  });
  handle("episodes:delete", (v) =>
    store.deleteEpisode(projectIdSchema.parse(v).id),
  );
  handle("projects:set-cover", (v) => {
    const x = setProjectCoverSchema.parse(v);
    return store.setProjectCover(x.projectId, x.assetId);
  });
  handle("pages:add", (v) => {
    const x = pageInputSchema.parse(v);
    return store.addPage(x.episodeId, x.imageAssetId);
  });
  handle("pages:duplicate", (v) =>
    store.duplicatePage(projectIdSchema.parse(v).id),
  );
  handle("pages:delete", (v) => store.deletePage(projectIdSchema.parse(v).id));
  handle("pages:reorder", (v) => {
    const x = reorderPagesSchema.parse(v);
    return store.reorderPages(x.episodeId, x.pageIds);
  });
  handle("pages:save", (v) => {
    const x = pagePromptSchema.parse(v);
    return store.savePage(x.id, x.prompt, x.negativePrompt, x.notes);
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
  handle("assets:delete", (v) => store.deleteAsset(assetIdSchema.parse(v).id));
  handle("assets:url", (v) =>
    store.assetData(
      v && typeof v.relativePath === "string" ? v.relativePath : "",
    ),
  );
  handle("ai:settings:list", () => store.getProviderSettings());
  handle("ai:settings:save", (v) =>
    store.saveProviderSettings(providerSettingsSchema.parse(v)),
  );
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
}
app.whenReady().then(async () => {
  store = new MangaiDatabase(desktopPaths());
  aiService = new AIService(store);
  register();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => store?.close());

export { desktopPaths };
