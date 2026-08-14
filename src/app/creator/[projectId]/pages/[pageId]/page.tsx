import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  getCloudPageSnapshot,
  getCloudProjectWorkspace,
  listCloudAssets,
  listCloudGenerationJobs,
  getMyCloudAiQuota,
} from "@/lib/cloud-creator-server";
import { getCloudPageDialoguePlacement } from "@/modules/cloud-creator/canvas/dialogue-placement-service";
import { getCloudPageCompletion } from "@/modules/cloud-creator/projects/page-completion-service";
import { CloudCanvasEditor } from "./CloudCanvasEditor";
import { getCloudGeneralMonitorEnrollment, isCloudGeneralMonitorActive } from "@/lib/cloud-general-monitor";
import {
  cloudPanelImageGenerationFeatureEnabled,
  cloudPanelInpaintingFeatureEnabled,
  cloudPanelOutpaintingFeatureEnabled,
} from "@/lib/cloud-panel-image-generation";
import { ResourceNotFoundError } from "@/lib/domain-errors";

export default async function CloudCanvasPage({
  params,
}: {
  params: Promise<{ projectId: string; pageId: string }>;
}) {
  const { profile } = await requireProfile();
  const { projectId, pageId } = await params;
  let workspace: Awaited<ReturnType<typeof getCloudProjectWorkspace>>;
  let snapshot: Awaited<ReturnType<typeof getCloudPageSnapshot>>;
  let assets: Awaited<ReturnType<typeof listCloudAssets>>;
  let generationJobs: Awaited<ReturnType<typeof listCloudGenerationJobs>>;
  const quotaPromise = getMyCloudAiQuota().catch(() => null);
  const dialoguePlacementPromise = getCloudPageDialoguePlacement(pageId).catch(
    () => null,
  );
  const pageCompletionPromise = getCloudPageCompletion(projectId, pageId).catch(
    () => null,
  );
  try {
    [workspace, snapshot, assets, generationJobs] = await Promise.all([
      getCloudProjectWorkspace(projectId),
      getCloudPageSnapshot(pageId),
      listCloudAssets(projectId),
      listCloudGenerationJobs(projectId),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }
  const page = workspace.pages.find((candidate) => candidate.id === pageId);
  if (!page || snapshot.project_id !== projectId) notFound();
  const quota = await quotaPromise;
  const dialoguePlacement = await dialoguePlacementPromise;
  const pageCompletion = await pageCompletionPromise;
  const monitorQualityFeedbackEnabled = isCloudGeneralMonitorActive(
    await getCloudGeneralMonitorEnrollment(profile.id),
  );
  return (
    <CloudCanvasEditor
      project={workspace.project}
      pages={workspace.pages}
      page={page}
      initialCanvas={snapshot.canvas}
      initialAssets={assets}
      initialGenerationJobs={generationJobs}
      initialQuota={quota}
      initialDialoguePlacement={dialoguePlacement}
      initialPageCompletion={pageCompletion}
      storyboardPanelGenerationEnabled={cloudPanelImageGenerationFeatureEnabled()}
      panelInpaintingEnabled={cloudPanelInpaintingFeatureEnabled()}
      panelOutpaintingEnabled={cloudPanelOutpaintingFeatureEnabled()}
      monitorQualityFeedbackEnabled={monitorQualityFeedbackEnabled}
    />
  );
}
