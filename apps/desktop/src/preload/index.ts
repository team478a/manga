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
  renameEpisode: (id: string, title: string) =>
    ipcRenderer.invoke("episodes:rename", { id, title }),
  reorderEpisodes: (projectId: string, episodeIds: string[]) =>
    ipcRenderer.invoke("episodes:reorder", { projectId, episodeIds }),
  deleteEpisode: (id: string) => ipcRenderer.invoke("episodes:delete", { id }),
  setProjectCover: (projectId: string, assetId: string) =>
    ipcRenderer.invoke("projects:set-cover", { projectId, assetId }),
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
  ai: {
    listSettings: () => ipcRenderer.invoke("ai:settings:list"),
    saveSettings: (value: unknown) =>
      ipcRenderer.invoke("ai:settings:save", value),
    checkProvider: (providerId: string) =>
      ipcRenderer.invoke("ai:provider:check", { providerId }),
    listModels: (providerId: string) =>
      ipcRenderer.invoke("ai:provider:models", { providerId }),
    listTemplates: () => ipcRenderer.invoke("ai:templates:list"),
    saveTemplate: (value: unknown) =>
      ipcRenderer.invoke("ai:templates:save", value),
    deleteTemplate: (id: string) =>
      ipcRenderer.invoke("ai:templates:delete", { id }),
    listSessions: (projectId?: string) =>
      ipcRenderer.invoke("ai:chat:sessions", { projectId }),
    listMessages: (id: string) =>
      ipcRenderer.invoke("ai:chat:messages", { id }),
    renameSession: (id: string, title: string) =>
      ipcRenderer.invoke("ai:chat:rename", { id, title }),
    deleteSession: (id: string) => ipcRenderer.invoke("ai:chat:delete", { id }),
    sendChat: (value: unknown) => ipcRenderer.invoke("ai:chat:send", value),
    cancel: (requestId: string) =>
      ipcRenderer.invoke("ai:request:cancel", { requestId }),
    onChatEvent: (listener: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, value: unknown) =>
        listener(value);
      ipcRenderer.on("ai:chat:event", handler);
      return () => ipcRenderer.removeListener("ai:chat:event", handler);
    },
    listJobs: (projectId?: string) =>
      ipcRenderer.invoke("ai:jobs:list", { projectId }),
    generateImage: (value: unknown) =>
      ipcRenderer.invoke("ai:image:generate", value),
    listWorkflows: () => ipcRenderer.invoke("ai:workflows:list"),
    addWorkflow: (name: string, mapping: unknown) =>
      ipcRenderer.invoke("ai:workflows:add", { name, mapping }),
    deleteWorkflow: (id: string) =>
      ipcRenderer.invoke("ai:workflows:delete", { id }),
  },
});
