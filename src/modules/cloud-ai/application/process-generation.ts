// Compatibility bridge while Provider and generated Storage are separated in
// PR-R2B-3 and PR-R2B-4. New Worker callers enter through this application seam.
export {
  processNextCloudGenerationJob,
  processPendingCloudStorageCleanup,
} from "../../../lib/cloud-ai-worker.ts";
