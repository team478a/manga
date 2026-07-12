import type { ProjectBundle, Project } from "@mangai/project-core";
import type { ProjectInput } from "@mangai/shared";
export type DesktopApi = {
  listProjects: () => Promise<Project[]>;
  projectCover: (id: string) => Promise<string | null>;
  createProject: (v: ProjectInput) => Promise<ProjectBundle>;
  openProject: (id: string) => Promise<ProjectBundle>;
  renameProject: (id: string, title: string) => Promise<ProjectBundle>;
  duplicateProject: (id: string) => Promise<ProjectBundle>;
  deleteProject: (id: string) => Promise<void>;
  exportProject: (id: string) => Promise<{
    outputDir: string;
    files: string[];
    warnings: string[];
  }>;
  createEpisode: (projectId: string, title: string) => Promise<ProjectBundle>;
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
};
declare global {
  interface Window {
    mangai: DesktopApi;
  }
}
