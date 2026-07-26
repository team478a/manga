/**
 * Compatibility entrypoint for Cloud Creator server features.
 *
 * New code should import from `src/modules/cloud-creator/*`. Existing routes
 * and server components can keep this public surface while modules are split.
 */
export type {
  CloudAiQuota,
  CloudAsset,
  CloudEpisode,
  CloudGenerationJob,
  CloudPage,
  CloudProjectSummary,
} from "@/modules/cloud-creator/contracts/types";

export {
  cancelCloudGenerationJob,
  enqueueCloudGenerationJob,
  getMyCloudAiQuota,
  listCloudGenerationJobs,
} from "@/modules/cloud-creator/generation/generation-service";

export {
  createCloudProject,
  getCloudProjectWorkspace,
  listCloudProjects,
  listDeletedCloudProjects,
  renameCloudProject,
  setCloudProjectCover,
  setCloudProjectDeleted,
} from "@/modules/cloud-creator/projects/project-service";

export {
  addCloudEpisode,
  addCloudPage,
  deleteCloudStructure,
  moveCloudStructure,
  renameCloudEpisode,
} from "@/modules/cloud-creator/structure/structure-service";

export {
  getCloudPageSnapshot,
  saveCloudPageSnapshot,
} from "@/modules/cloud-creator/canvas/canvas-service";

export {
  createCloudAssetSignedUrl,
  listCloudAssets,
  uploadCloudAsset,
} from "@/modules/cloud-creator/assets/asset-service";

export { importDesktopCloudProject } from "@/modules/cloud-creator/import/import-service";
export { stageCloudProjectExportBundle } from "@/modules/cloud-creator/export/export-service";
