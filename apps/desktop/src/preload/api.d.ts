import type { Asset, ProjectBundle, Project } from "@mangai/project-core";
import type { AssetLibraryMetadataInput, ProjectInput } from "@mangai/shared";
import type {
  GenerationRouteDecisionRecord,
  GenerationQueueSettings,
  PageBatchImageRequest,
  ComfyWorkflowOptimization,
  ComfyLowSpecRuntimeReport,
  ExternalDispatchPreview,
  ProjectGenerationPolicy,
  ProjectGenerationPolicyInput,
  ProviderSettings,
  RouteDecision,
  RuntimeProfileSelection,
  RuntimeProfileState,
  SafeAssetLibraryRequest,
} from "@mangai/ai-core";
import type {
  Balloon,
  Panel,
  PanelLayer,
  TextObject,
} from "@mangai/canvas-core";
import type { EpisodeTemplateId } from "@mangai/canvas-core";
export type ChatEvent = {
  requestId: string;
  sessionId: string;
  type: "start" | "chunk" | "complete" | "error" | "canceled";
  text?: string;
  jobId?: string;
  message?: string;
};
export type OperationHistory = {
  items: Array<{
    id: number;
    label: string;
    isUndone: number;
    createdAt: string;
  }>;
  canUndo: boolean;
  canRedo: boolean;
};
export type UpdateState = {
  status:
    | "disabled"
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error";
  currentVersion: string;
  channel: "stable" | "beta";
  availableVersion?: string;
  percent?: number;
  message: string;
};
export type ExportProgress = {
  requestId: string;
  current: number;
  total: number;
  percent: number;
  pageNumber?: number;
  status: "rendering" | "packaging" | "complete";
};
export type ExportHistoryItem = {
  id: string;
  outputDir: string;
  files: string[];
  warnings: string[];
  createdAt: string;
};
export type AISettingsHistoryItem = {
  id: string;
  providerId: "ollama" | "comfyui" | "mock";
  changedFields: string[];
  summary: {
    enabled: boolean;
    endpointKind: "local" | "remote";
    modelSelected: boolean;
  };
  createdAt: string;
};
export type AutoBackupState = {
  status: "idle" | "running" | "success" | "error";
  checkedAt?: string;
  createdCount: number;
  skippedCount: number;
  message: string;
};
export type DatabaseRecoveryState = {
  recovered: true;
  detectedAt: string;
  reason: string;
  archiveDirectory: string;
  source: "project-backups" | "sqlite-backup" | "empty";
  restoredProjects: string[];
  failedBackups: Array<{ filePath: string; message: string }>;
};
export type HubStatus =
  | {
      linked: true;
      projectId: string;
      work: {
        id: string;
        title: string;
        description: string;
        status: "draft" | "published" | "archived";
        isPublic: boolean;
        updatedAt: string;
        path: string;
        canWriteDraft: boolean;
      };
      sales: {
        activeProductCount: number;
        pausedProductCount: number;
        available: boolean;
      };
    }
  | { linked: false; message: string };
export type HubDeviceState = {
  baseUrl: string;
  userCode: string;
  verificationPath: string;
  expiresAt: string;
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  approvedAt?: string | null;
  tokenExpiresAt?: string | null;
  scopes?: string[];
};
export type DiagnosticsState = {
  detailedCrashReportsEnabled: boolean;
  externalUploadEnabled: boolean;
  externalUploadAvailable: boolean;
  logDirectory: string;
  logFile: string;
  crashReportCount: number;
  pendingUploadCount: number;
  lastUploadAt: string | null;
  updatedAt: string | null;
};
export type DesktopApi = {
  diagnostics: {
    getState: () => Promise<DiagnosticsState>;
    setConsent: (enabled: boolean) => Promise<DiagnosticsState>;
    setUploadConsent: (enabled: boolean) => Promise<DiagnosticsState>;
    uploadPending: () => Promise<DiagnosticsState>;
    openLogs: () => Promise<true>;
    clearCrashReports: () => Promise<DiagnosticsState>;
  };
  hubStatus: (projectId: string, baseUrl: string) => Promise<HubStatus>;
  updateHubDraft: (value: {
    projectId: string;
    baseUrl: string;
    title: string;
    description: string;
    expectedUpdatedAt: string;
  }) => Promise<{
    updated: true;
    work: { id: string; title: string; description: string; updatedAt: string };
  }>;
  hubDeviceState: () => Promise<HubDeviceState | null>;
  startHubDeviceAuthorization: (baseUrl: string) => Promise<HubDeviceState>;
  pollHubDeviceAuthorization: () => Promise<HubDeviceState>;
  disconnectHubDevice: () => Promise<null>;
  listProjects: () => Promise<Project[]>;
  chooseProjectStorage: (currentPath?: string) => Promise<string | null>;
  projectCover: (id: string) => Promise<string | null>;
  createProject: (v: ProjectInput) => Promise<ProjectBundle>;
  openProject: (id: string) => Promise<ProjectBundle>;
  renameProject: (id: string, title: string) => Promise<ProjectBundle>;
  duplicateProject: (id: string) => Promise<ProjectBundle>;
  backupProject: (
    id: string,
  ) => Promise<{ filePath: string; byteSize: number } | null>;
  autoBackupStatus: () => Promise<AutoBackupState>;
  runAutoBackup: () => Promise<AutoBackupState>;
  restoreProject: () => Promise<ProjectBundle | null>;
  deleteProject: (id: string) => Promise<void>;
  exportProject: (
    id: string,
    requestId: string,
  ) => Promise<{
    outputDir: string;
    files: string[];
    warnings: string[];
  }>;
  cancelExport: (requestId: string) => Promise<boolean>;
  listExportHistory: (projectId: string) => Promise<ExportHistoryItem[]>;
  onExportProgress: (listener: (value: ExportProgress) => void) => () => void;
  createEpisode: (projectId: string, title: string) => Promise<ProjectBundle>;
  renameEpisode: (id: string, title: string) => Promise<ProjectBundle>;
  reorderEpisodes: (
    projectId: string,
    episodeIds: string[],
  ) => Promise<ProjectBundle>;
  deleteEpisode: (id: string) => Promise<ProjectBundle>;
  applyEpisodeTemplate: (
    episodeId: string,
    templateId: EpisodeTemplateId,
  ) => Promise<ProjectBundle>;
  setProjectCover: (
    projectId: string,
    assetId: string,
  ) => Promise<ProjectBundle>;
  addPage: (episodeId: string, imageAssetId?: string) => Promise<ProjectBundle>;
  duplicatePage: (id: string) => Promise<ProjectBundle>;
  deletePage: (id: string) => Promise<ProjectBundle>;
  reorderPages: (
    episodeId: string,
    pageIds: string[],
  ) => Promise<ProjectBundle>;
  savePage: (
    id: string,
    prompt: string,
    negativePrompt: string,
    notes: string,
  ) => Promise<ProjectBundle>;
  canvas: {
    savePanel: (
      value: Omit<Panel, "createdAt" | "updatedAt">,
    ) => Promise<ProjectBundle>;
    savePanelLayers: (value: {
      panelId: string;
      layers: Array<Omit<PanelLayer, "createdAt" | "updatedAt">>;
    }) => Promise<ProjectBundle>;
    saveBalloon: (
      value: Omit<Balloon, "createdAt" | "updatedAt">,
    ) => Promise<ProjectBundle>;
    saveText: (
      value: Omit<TextObject, "createdAt" | "updatedAt">,
    ) => Promise<ProjectBundle>;
    deleteObject: (
      type: "panel" | "balloon" | "text",
      id: string,
    ) => Promise<ProjectBundle>;
    saveBatch: (value: {
      pageId: string;
      panels?: Array<Omit<Panel, "createdAt" | "updatedAt">>;
      balloons?: Array<Omit<Balloon, "createdAt" | "updatedAt">>;
      textObjects?: Array<Omit<TextObject, "createdAt" | "updatedAt">>;
      replacePanels?: boolean;
      replaceBalloons?: boolean;
      replaceTextObjects?: boolean;
    }) => Promise<ProjectBundle>;
  };
  listHistory: (projectId: string) => Promise<OperationHistory>;
  undo: (projectId: string) => Promise<ProjectBundle>;
  redo: (projectId: string) => Promise<ProjectBundle>;
  pickAssets: (projectId: string) => Promise<ProjectBundle>;
  importDroppedAssets: (
    projectId: string,
    files: File[],
  ) => Promise<ProjectBundle>;
  deleteAsset: (id: string) => Promise<ProjectBundle>;
  saveAssetLibraryMetadata: (
    value: AssetLibraryMetadataInput,
  ) => Promise<ProjectBundle>;
  assetUrl: (relativePath: string) => Promise<string>;
  getPaths: () => Promise<{
    root: string;
    database: string;
    projects: string;
    assets: string;
    exports: string;
    logs: string;
  }>;
  databaseRecoveryStatus: () => Promise<DatabaseRecoveryState | null>;
  updater: {
    getState: () => Promise<UpdateState>;
    setChannel: (channel: "stable" | "beta") => Promise<UpdateState>;
    check: () => Promise<UpdateState>;
    download: () => Promise<UpdateState>;
    install: () => Promise<boolean>;
    onStatus: (listener: (value: UpdateState) => void) => () => void;
  };
  ai: {
    runtimeInfo: () => Promise<{
      mockEnabled: boolean;
      runtimeProfile: RuntimeProfileState;
    }>;
    saveRuntimeProfile: (
      selection: RuntimeProfileSelection,
    ) => Promise<RuntimeProfileState>;
    getGenerationPolicy: (
      projectId: string,
    ) => Promise<ProjectGenerationPolicy>;
    saveGenerationPolicy: (
      value: ProjectGenerationPolicyInput,
    ) => Promise<ProjectGenerationPolicy>;
    listSettings: () => Promise<ProviderSettings[]>;
    listSettingsHistory: () => Promise<AISettingsHistoryItem[]>;
    saveSettings: (value: ProviderSettings) => Promise<ProviderSettings[]>;
    checkProvider: (
      providerId: string,
    ) => Promise<{ ok: boolean; message: string; latencyMs?: number }>;
    inspectComfyLowSpecRuntime: () => Promise<ComfyLowSpecRuntimeReport>;
    listModels: (
      providerId: string,
    ) => Promise<
      Array<{ id: string; name: string; cached?: boolean; updatedAt?: string }>
    >;
    listTemplates: () => Promise<
      Array<{
        id: string;
        name: string;
        template: string;
        systemPrompt: string;
        isBuiltin: number;
      }>
    >;
    saveTemplate: (value: {
      id?: string;
      name: string;
      template: string;
      systemPrompt: string;
    }) => Promise<
      Array<{
        id: string;
        name: string;
        template: string;
        systemPrompt: string;
        isBuiltin: number;
      }>
    >;
    deleteTemplate: (id: string) => Promise<
      Array<{
        id: string;
        name: string;
        template: string;
        systemPrompt: string;
        isBuiltin: number;
      }>
    >;
    listSessions: (projectId?: string) => Promise<any[]>;
    listMessages: (id: string) => Promise<any[]>;
    renameSession: (id: string, title: string) => Promise<any[]>;
    deleteSession: (id: string) => Promise<any[]>;
    sendChat: (value: any) => Promise<{ requestId: string }>;
    cancel: (requestId: string) => Promise<boolean>;
    onChatEvent: (listener: (event: ChatEvent) => void) => () => void;
    listJobs: (projectId?: string) => Promise<any[]>;
    getQueueSettings: () => Promise<GenerationQueueSettings>;
    saveQueueSettings: (
      value: GenerationQueueSettings,
    ) => Promise<GenerationQueueSettings>;
    pauseJob: (id: string) => Promise<boolean>;
    resumeJob: (id: string) => Promise<boolean>;
    changeJobPriority: (id: string, delta: -1 | 1) => Promise<any[]>;
    listRouteDecisions: (
      projectId: string,
    ) => Promise<GenerationRouteDecisionRecord[]>;
    resolveSafeAssetLibrary: (value: SafeAssetLibraryRequest) => Promise<{
      jobId: string;
      status: "completed" | "failed";
      decision: RouteDecision;
      assets: Asset[];
      message?: string;
    }>;
    previewExternalSafeAsset: (
      value: SafeAssetLibraryRequest,
    ) => Promise<ExternalDispatchPreview>;
    generateImage: (value: any) => Promise<any>;
    enqueuePageBatch: (value: PageBatchImageRequest) => Promise<{
      jobs: Array<{ pageId: string; jobId: string }>;
      queuedCount: number;
      skippedPageIds: string[];
    }>;
    listWorkflows: () => Promise<any[]>;
    addWorkflow: (name: string, mapping: unknown) => Promise<any[]>;
    deleteWorkflow: (id: string) => Promise<any[]>;
    updateWorkflow: (
      id: string,
      name: string,
      mapping: unknown,
    ) => Promise<any[]>;
    setDefaultWorkflow: (id: string) => Promise<any[]>;
    validateWorkflow: (
      id: string,
    ) => Promise<{
      ok: boolean;
      message: string;
      fields?: string[];
      warnings: string[];
      optimization: ComfyWorkflowOptimization;
    }>;
    testWorkflow: (id: string) => Promise<{ ok: boolean; message: string }>;
  };
};
declare global {
  interface Window {
    mangai: DesktopApi;
  }
}
