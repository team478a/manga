import type { ProjectBundle, Project } from "@mangai/project-core";
import type { ProjectInput } from "@mangai/shared";
import type { ProviderSettings } from "@mangai/ai-core";
import type { Balloon, Panel, TextObject } from "@mangai/canvas-core";
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
export type DesktopApi = {
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
  onExportProgress: (listener: (value: ExportProgress) => void) => () => void;
  createEpisode: (projectId: string, title: string) => Promise<ProjectBundle>;
  renameEpisode: (id: string, title: string) => Promise<ProjectBundle>;
  reorderEpisodes: (
    projectId: string,
    episodeIds: string[],
  ) => Promise<ProjectBundle>;
  deleteEpisode: (id: string) => Promise<ProjectBundle>;
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
  assetUrl: (relativePath: string) => Promise<string>;
  getPaths: () => Promise<{
    root: string;
    database: string;
    projects: string;
    assets: string;
    exports: string;
    logs: string;
  }>;
  updater: {
    getState: () => Promise<UpdateState>;
    check: () => Promise<UpdateState>;
    download: () => Promise<UpdateState>;
    install: () => Promise<boolean>;
    onStatus: (listener: (value: UpdateState) => void) => () => void;
  };
  ai: {
    runtimeInfo: () => Promise<{ mockEnabled: boolean }>;
    listSettings: () => Promise<ProviderSettings[]>;
    saveSettings: (value: ProviderSettings) => Promise<ProviderSettings[]>;
    checkProvider: (
      providerId: string,
    ) => Promise<{ ok: boolean; message: string; latencyMs?: number }>;
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
    generateImage: (value: any) => Promise<any>;
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
    ) => Promise<{ ok: boolean; message: string; fields?: string[] }>;
    testWorkflow: (id: string) => Promise<{ ok: boolean; message: string }>;
  };
};
declare global {
  interface Window {
    mangai: DesktopApi;
  }
}
