import type { CloudPanelImageGenerationRequestInput } from "../contracts/panel-generation";

export type PanelRevisionOptions = Omit<
  CloudPanelImageGenerationRequestInput,
  "projectId" | "pageId" | "panelId" | "idempotencyKey" | "candidateCount"
>;

export function buildPanelRevisionRequest(input: {
  projectId: string;
  pageId: string;
  panelId: string;
  idempotencyKey: string;
  candidateCount: number;
  options?: PanelRevisionOptions;
}): CloudPanelImageGenerationRequestInput {
  return {
    projectId: input.projectId,
    pageId: input.pageId,
    panelId: input.panelId,
    idempotencyKey: input.idempotencyKey,
    candidateCount: input.candidateCount,
    sourceAssetId: input.options?.sourceAssetId,
    maskAssetId: input.options?.maskAssetId,
    outpaintingDirection: input.options?.outpaintingDirection,
    revisionPreset: input.options?.revisionPreset,
    revisionInstruction: input.options?.revisionInstruction,
    shotOverride: input.options?.shotOverride,
    cameraAngleOverride: input.options?.cameraAngleOverride,
    subjectPlacement: input.options?.subjectPlacement,
    gazeDirection: input.options?.gazeDirection,
    compositionInstruction: input.options?.compositionInstruction,
    generationTarget: input.options?.generationTarget,
  };
}
