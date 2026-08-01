/**
 * Compatibility entrypoint for Cloud Creator server features.
 *
 * New code should import from `src/modules/cloud-creator/*`. Existing routes
 * and server components can keep this public surface while modules are split.
 */
export type {
  CloudAiQuota,
  CloudAsset,
  CloudChapter,
  CloudEpisode,
  CloudGenerationJob,
  CloudLongformStructure,
  CloudPage,
  CloudProjectSummary,
  CloudScene,
} from "@/modules/cloud-creator/contracts/types";

export {
  cancelCloudGenerationJob,
  enqueueCloudGenerationJob,
  getMyCloudAiQuota,
  listCloudGenerationJobs,
} from "@/modules/cloud-creator/generation/generation-service";
export type { CloudGenerationBatch } from "@/modules/cloud-creator/generation/batch-production-service";
export {
  listCloudGenerationBatches,
  retryFailedCloudGenerationJob,
  setCloudGenerationBatchState,
  startCloudPageGenerationBatch,
} from "@/modules/cloud-creator/generation/batch-production-service";

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
  getCloudManuscriptPreflight,
  getCloudProductionProgress,
} from "@/modules/cloud-creator/projects/manuscript-preflight-service";
export { getCloudProjectCharacterSheet } from "@/modules/cloud-creator/projects/character-sheet-service";
export { getCloudContinuityReview } from "@/modules/cloud-creator/projects/continuity-review-service";
export {
  deleteCloudCharacterProfile,
  listCloudCharacterProfiles,
  saveCloudCharacterProfile,
} from "@/modules/cloud-creator/projects/character-profile-service";
export {
  deleteCloudWorldProfile,
  getCloudWorldBible,
  saveCloudStyleBible,
  saveCloudWorldProfile,
} from "@/modules/cloud-creator/projects/world-bible-service";
export {
  deleteCloudPanelSubjectAssignment,
  deleteCloudVisualReference,
  getCloudVisualReferenceWorkspace,
  saveCloudPanelSubjectAssignment,
  saveCloudVisualReference,
} from "@/modules/cloud-creator/projects/visual-reference-service";

export {
  addCloudChapter,
  addCloudEpisode,
  addCloudEpisodeToChapter,
  addCloudPage,
  addCloudPageToScene,
  addCloudScene,
  deleteCloudStructure,
  moveCloudPageBefore,
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
