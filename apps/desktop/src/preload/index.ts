import { contextBridge, ipcRenderer, webUtils } from "electron";
contextBridge.exposeInMainWorld("mangai", {
  diagnostics: {
    getState: () => ipcRenderer.invoke("diagnostics:state"),
    setConsent: (enabled: boolean) =>
      ipcRenderer.invoke("diagnostics:consent", { enabled }),
    setUploadConsent: (enabled: boolean) =>
      ipcRenderer.invoke("diagnostics:upload-consent", { enabled }),
    uploadPending: () => ipcRenderer.invoke("diagnostics:upload-pending"),
    openLogs: () => ipcRenderer.invoke("diagnostics:open-logs"),
    clearCrashReports: () => ipcRenderer.invoke("diagnostics:clear-crashes"),
  },
  hubStatus: (projectId: string, baseUrl: string) =>
    ipcRenderer.invoke("hub:status", { projectId, baseUrl }),
  updateHubDraft: (value: unknown) =>
    ipcRenderer.invoke("hub:draft:update", value),
  hubDeviceState: () => ipcRenderer.invoke("hub:device:state"),
  startHubDeviceAuthorization: (baseUrl: string) =>
    ipcRenderer.invoke("hub:device:start", { baseUrl }),
  pollHubDeviceAuthorization: () => ipcRenderer.invoke("hub:device:poll"),
  disconnectHubDevice: () => ipcRenderer.invoke("hub:device:disconnect"),
  listProjects: () => ipcRenderer.invoke("projects:list"),
  chooseProjectStorage: (currentPath?: string) =>
    ipcRenderer.invoke("projects:choose-storage", { currentPath }),
  projectCover: (id: string) => ipcRenderer.invoke("projects:cover", { id }),
  createProject: (v: unknown) => ipcRenderer.invoke("projects:create", v),
  openProject: (id: string) => ipcRenderer.invoke("projects:open", { id }),
  renameProject: (id: string, title: string) =>
    ipcRenderer.invoke("projects:rename", { id, title }),
  changeProjectContentClass: (id: string, contentClass: "general" | "adult") =>
    ipcRenderer.invoke("projects:content-class", { id, contentClass }),
  duplicateProject: (id: string) =>
    ipcRenderer.invoke("projects:duplicate", { id }),
  backupProject: (id: string, requestId: string) =>
    ipcRenderer.invoke("projects:backup", { id, requestId }),
  autoBackupStatus: () => ipcRenderer.invoke("projects:auto-backup:status"),
  runAutoBackup: () => ipcRenderer.invoke("projects:auto-backup:run"),
  restoreProject: (requestId: string) =>
    ipcRenderer.invoke("projects:restore", { requestId }),
  cancelBulkOperation: (requestId: string) =>
    ipcRenderer.invoke("projects:bulk:cancel", { requestId }),
  onBulkOperationProgress: (listener: (value: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) =>
      listener(value);
    ipcRenderer.on("projects:bulk:progress", handler);
    return () =>
      ipcRenderer.removeListener("projects:bulk:progress", handler);
  },
  deleteProject: (id: string) => ipcRenderer.invoke("projects:delete", { id }),
  exportProject: (id: string, requestId: string) =>
    ipcRenderer.invoke("projects:export", { id, requestId }),
  cancelExport: (requestId: string) =>
    ipcRenderer.invoke("projects:export:cancel", { requestId }),
  listExportHistory: (projectId: string) =>
    ipcRenderer.invoke("projects:export:history", { id: projectId }),
  onExportProgress: (listener: (value: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) =>
      listener(value);
    ipcRenderer.on("projects:export:progress", handler);
    return () =>
      ipcRenderer.removeListener("projects:export:progress", handler);
  },
  createEpisode: (projectId: string, title: string) =>
    ipcRenderer.invoke("episodes:create", { projectId, title }),
  renameEpisode: (id: string, title: string) =>
    ipcRenderer.invoke("episodes:rename", { id, title }),
  reorderEpisodes: (projectId: string, episodeIds: string[]) =>
    ipcRenderer.invoke("episodes:reorder", { projectId, episodeIds }),
  deleteEpisode: (id: string) => ipcRenderer.invoke("episodes:delete", { id }),
  applyEpisodeTemplate: (episodeId: string, templateId: string) =>
    ipcRenderer.invoke("episodes:apply-template", { episodeId, templateId }),
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
  canvas: {
    savePanel: (value: unknown) =>
      ipcRenderer.invoke("canvas:panel:save", value),
    savePanelLayers: (value: unknown) =>
      ipcRenderer.invoke("canvas:panel-layers:save", value),
    saveBalloon: (value: unknown) =>
      ipcRenderer.invoke("canvas:balloon:save", value),
    saveText: (value: unknown) => ipcRenderer.invoke("canvas:text:save", value),
    deleteObject: (type: "panel" | "balloon" | "text", id: string) =>
      ipcRenderer.invoke("canvas:object:delete", { type, id }),
    saveBatch: (value: unknown) =>
      ipcRenderer.invoke("canvas:batch:save", value),
  },
  listHistory: (projectId: string) =>
    ipcRenderer.invoke("history:list", { id: projectId }),
  undo: (projectId: string) =>
    ipcRenderer.invoke("history:undo", { id: projectId }),
  redo: (projectId: string) =>
    ipcRenderer.invoke("history:redo", { id: projectId }),
  pickAssets: (projectId: string) =>
    ipcRenderer.invoke("assets:pick", { id: projectId }),
  importDroppedAssets: (projectId: string, files: File[]) =>
    ipcRenderer.invoke("assets:import", {
      projectId,
      paths: files.map((f) => webUtils.getPathForFile(f)).filter(Boolean),
    }),
  deleteAsset: (id: string) => ipcRenderer.invoke("assets:delete", { id }),
  saveAssetLibraryMetadata: (value: {
    assetId: string;
    category: string;
    tags: string[];
    favorite: boolean;
  }) => ipcRenderer.invoke("assets:library:save", value),
  listCharacterProfiles: (projectId: string) =>
    ipcRenderer.invoke("characters:list", { id: projectId }),
  saveCharacterProfile: (value: unknown) =>
    ipcRenderer.invoke("characters:save", value),
  deleteCharacterProfile: (id: string) =>
    ipcRenderer.invoke("characters:delete", { id }),
  attachCharacterReferenceAsset: (value: unknown) =>
    ipcRenderer.invoke("characters:reference:attach", value),
  detachCharacterReferenceAsset: (
    characterProfileId: string,
    assetId: string,
  ) =>
    ipcRenderer.invoke("characters:reference:detach", {
      characterProfileId,
      assetId,
    }),
  listAdultReferenceImageAssessments: (projectId: string) =>
    ipcRenderer.invoke("assets:adult-reference-assessments:list", {
      id: projectId,
    }),
  saveAdultReferenceImageAssessment: (value: unknown) =>
    ipcRenderer.invoke("assets:adult-reference-assessment:save", value),
  assetUrl: (relativePath: string) =>
    ipcRenderer.invoke("assets:url", { relativePath }),
  getPaths: () => ipcRenderer.invoke("app:paths"),
  databaseRecoveryStatus: () => ipcRenderer.invoke("database:recovery:status"),
  updater: {
    getState: () => ipcRenderer.invoke("update:state"),
    setChannel: (channel: "stable" | "beta") =>
      ipcRenderer.invoke("update:channel", { channel }),
    check: () => ipcRenderer.invoke("update:check"),
    download: () => ipcRenderer.invoke("update:download"),
    install: () => ipcRenderer.invoke("update:install"),
    onStatus: (listener: (value: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, value: unknown) =>
        listener(value);
      ipcRenderer.on("update:status", handler);
      return () => ipcRenderer.removeListener("update:status", handler);
    },
  },
  ai: {
    runtimeInfo: () => ipcRenderer.invoke("ai:runtime"),
    chooseAdultPilotDirectory: () =>
      ipcRenderer.invoke("ai:adult-pilot:choose-directory"),
    downloadAdultPilot: (root: string, consent: unknown) =>
      ipcRenderer.invoke("ai:adult-pilot:download", { root, consent }),
    cancelAdultPilotDownload: () =>
      ipcRenderer.invoke("ai:adult-pilot:cancel"),
    installAdultPilotRuntime: (root: string, consent: unknown) =>
      ipcRenderer.invoke("ai:adult-pilot:install-runtime", { root, consent }),
    onAdultPilotProgress: (listener: (value: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, value: unknown) =>
        listener(value);
      ipcRenderer.on("ai:adult-pilot:progress", handler);
      return () => ipcRenderer.removeListener("ai:adult-pilot:progress", handler);
    },
    exportPhase5HardwareEvidence: (projectId: string) =>
      ipcRenderer.invoke("ai:phase5:hardware-evidence:export", {
        id: projectId,
      }),
    saveRuntimeProfile: (selection: unknown) =>
      ipcRenderer.invoke("ai:runtime:save", { selection }),
    getGenerationPolicy: (projectId: string) =>
      ipcRenderer.invoke("ai:generation-policy:get", { id: projectId }),
    saveGenerationPolicy: (value: unknown) =>
      ipcRenderer.invoke("ai:generation-policy:save", value),
    listSettings: () => ipcRenderer.invoke("ai:settings:list"),
    listSettingsHistory: () => ipcRenderer.invoke("ai:settings:history"),
    getAdultGenerationSettings: () =>
      ipcRenderer.invoke("ai:adult-settings:get"),
    getAdultProviderPolicyState: () =>
      ipcRenderer.invoke("ai:adult-provider-policy:get"),
    importAdultProviderPolicy: () =>
      ipcRenderer.invoke("ai:adult-provider-policy:import"),
    setAdultGenerationAdministratorEnabled: (enabled: boolean) =>
      ipcRenderer.invoke("ai:adult-settings:administrator", { enabled }),
    confirmAdultGeneration18Plus: (value: unknown) =>
      ipcRenderer.invoke("ai:adult-settings:confirm", value),
    revokeAdultGenerationConsent: () =>
      ipcRenderer.invoke("ai:adult-settings:revoke"),
    saveSettings: (value: unknown) =>
      ipcRenderer.invoke("ai:settings:save", value),
    credentialState: (providerId: "dezgo") =>
      ipcRenderer.invoke("ai:credential:state", { providerId }),
    saveCredential: (providerId: "dezgo", apiKey: string) =>
      ipcRenderer.invoke("ai:credential:save", { providerId, apiKey }),
    deleteCredential: (providerId: "dezgo") =>
      ipcRenderer.invoke("ai:credential:delete", { providerId }),
    checkProvider: (providerId: string) =>
      ipcRenderer.invoke("ai:provider:check", { providerId }),
    inspectComfyLowSpecRuntime: () =>
      ipcRenderer.invoke("ai:comfyui:low-spec-runtime"),
    listModels: (providerId: string, refresh = false) =>
      ipcRenderer.invoke("ai:provider:models", { providerId, refresh }),
    providerBalance: (providerId: "dezgo") =>
      ipcRenderer.invoke("ai:provider:balance", { providerId }),
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
    getQueueSettings: () => ipcRenderer.invoke("ai:queue:settings:get"),
    saveQueueSettings: (value: unknown) =>
      ipcRenderer.invoke("ai:queue:settings:save", value),
    pauseJob: (id: string) => ipcRenderer.invoke("ai:jobs:pause", { id }),
    resumeJob: (id: string) => ipcRenderer.invoke("ai:jobs:resume", { id }),
    changeJobPriority: (id: string, delta: -1 | 1) =>
      ipcRenderer.invoke("ai:jobs:priority", { id, delta }),
    listRouteDecisions: (projectId: string) =>
      ipcRenderer.invoke("ai:routes:list", { id: projectId }),
    resolveSafeAssetLibrary: (value: unknown) =>
      ipcRenderer.invoke("ai:asset-library:resolve", value),
    previewExternalSafeAsset: (value: unknown) =>
      ipcRenderer.invoke("ai:external-asset:preview", value),
    enqueueExternalSafeAsset: (value: unknown) =>
      ipcRenderer.invoke("ai:external-asset:enqueue", value),
    generateImage: (value: unknown) =>
      ipcRenderer.invoke("ai:image:generate", value),
    enqueuePageBatch: (value: unknown) =>
      ipcRenderer.invoke("ai:image:enqueue-pages", value),
    listWorkflows: () => ipcRenderer.invoke("ai:workflows:list"),
    addWorkflow: (name: string, mapping: unknown) =>
      ipcRenderer.invoke("ai:workflows:add", { name, mapping }),
    deleteWorkflow: (id: string) =>
      ipcRenderer.invoke("ai:workflows:delete", { id }),
    updateWorkflow: (id: string, name: string, mapping: unknown) =>
      ipcRenderer.invoke("ai:workflows:update", { id, name, mapping }),
    setDefaultWorkflow: (id: string) =>
      ipcRenderer.invoke("ai:workflows:default", { id }),
    validateWorkflow: (id: string) =>
      ipcRenderer.invoke("ai:workflows:validate", { id }),
    testWorkflow: (id: string) =>
      ipcRenderer.invoke("ai:workflows:test", { id }),
  },
});
