import { contextBridge, ipcRenderer, webUtils } from "electron";
contextBridge.exposeInMainWorld("mangai", {
  listProjects: () => ipcRenderer.invoke("projects:list"),
  projectCover: (id: string) => ipcRenderer.invoke("projects:cover", { id }),
  createProject: (v: unknown) => ipcRenderer.invoke("projects:create", v),
  openProject: (id: string) => ipcRenderer.invoke("projects:open", { id }),
  renameProject: (id: string, title: string) =>
    ipcRenderer.invoke("projects:rename", { id, title }),
  duplicateProject: (id: string) =>
    ipcRenderer.invoke("projects:duplicate", { id }),
  deleteProject: (id: string) => ipcRenderer.invoke("projects:delete", { id }),
  exportProject: (id: string) => ipcRenderer.invoke("projects:export", { id }),
  createEpisode: (projectId: string, title: string) =>
    ipcRenderer.invoke("episodes:create", { projectId, title }),
  addPage: (episodeId: string, imageAssetId?: string) =>
    ipcRenderer.invoke("pages:add", { episodeId, imageAssetId }),
  duplicatePage: (id: string) => ipcRenderer.invoke("pages:duplicate", { id }),
  deletePage: (id: string) => ipcRenderer.invoke("pages:delete", { id }),
  reorderPages: (episodeId: string, pageIds: string[]) =>
    ipcRenderer.invoke("pages:reorder", { episodeId, pageIds }),
  savePage: (
    id: string,
    prompt: string,
    negativePrompt: string,
    notes: string,
  ) => ipcRenderer.invoke("pages:save", { id, prompt, negativePrompt, notes }),
  pickAssets: (projectId: string) =>
    ipcRenderer.invoke("assets:pick", { id: projectId }),
  importDroppedAssets: (projectId: string, files: File[]) =>
    ipcRenderer.invoke("assets:import", {
      projectId,
      paths: files.map((f) => webUtils.getPathForFile(f)).filter(Boolean),
    }),
  deleteAsset: (id: string) => ipcRenderer.invoke("assets:delete", { id }),
  assetUrl: (relativePath: string) =>
    ipcRenderer.invoke("assets:url", { relativePath }),
  getPaths: () => ipcRenderer.invoke("app:paths"),
});
