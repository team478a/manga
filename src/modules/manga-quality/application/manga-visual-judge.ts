import type { PanelSpecification } from "../domain/panel-specification.ts";
import type { VisualEvidenceResult } from "../domain/visual-evidence.ts";

export type CandidateAsset = {
  id: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  sha256: string;
};

export type ReferenceAsset = CandidateAsset & {
  role: "identity" | "expression" | "full_body" | "background" | "prop";
};

export type PreviousNextPanelContext = {
  previous?: {
    specification: PanelSpecification;
    candidateAsset: CandidateAsset;
  };
  next?: {
    specification: PanelSpecification;
    candidateAsset: CandidateAsset;
  };
};

export type MangaVisualJudgeDescriptor = {
  id: string;
  kind: "vlm" | "embedding" | "detector" | "hybrid" | "mock";
  dataHandling: "external" | "local";
  structuredOutput: boolean;
  pricingSource: string | null;
};

export interface MangaVisualJudge {
  readonly descriptor: MangaVisualJudgeDescriptor;
  evaluate(input: {
    panelSpecification: PanelSpecification;
    candidateAsset: CandidateAsset;
    referenceAssets: ReferenceAsset[];
    context?: PreviousNextPanelContext;
  }): Promise<VisualEvidenceResult>;
}
