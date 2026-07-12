import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MangaiDatabase } from "./database.js";
import {
  assetIdSchema,
  episodeInputSchema,
  importAssetsSchema,
  pageInputSchema,
  pagePromptSchema,
  projectIdSchema,
  projectInputSchema,
  renameProjectSchema,
  reorderPagesSchema,
} from "@mangai/shared";

const here = path.dirname(fileURLToPath(import.meta.url));
let store: MangaiDatabase;
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
function handle(channel: string, fn: (value: any) => any) {
  ipcMain.handle(channel, async (_event, value) => {
    try {
      return await fn(value);
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
