import { panelSpecificationSchema } from "../domain/panel-specification.ts";
import { evaluatePanelCandidate } from "./rule-based-panel-judge.ts";
import {
  loadPanelSpecification,
  savePanelQualityEvaluation,
} from "../infrastructure/panel-quality-repository.ts";

export async function evaluateCompletedPanelCandidate(input: {
  client: any;
  generationJobId: string;
  assetAvailable: boolean;
  expectedWidth?: number;
  expectedHeight?: number;
  actualWidth?: number;
  actualHeight?: number;
}) {
  const startedAt = Date.now();
  const rawSpecification = await loadPanelSpecification(input);
  const specification = panelSpecificationSchema.safeParse(rawSpecification);
  if (!specification.success) return null;
  const evaluation = evaluatePanelCandidate(specification.data, {
    assetAvailable: input.assetAvailable,
    expectedWidth: input.expectedWidth,
    expectedHeight: input.expectedHeight,
    actualWidth: input.actualWidth,
    actualHeight: input.actualHeight,
  });
  await savePanelQualityEvaluation({
    client: input.client,
    generationJobId: input.generationJobId,
    evaluation,
    evaluationLatencyMs: Date.now() - startedAt,
  });
  return evaluation;
}
