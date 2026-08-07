import type { MangaQualityFailureCategory } from "./failure-category";

export const MANGA_GENERATION_MODES = [
  "text_to_image",
  "image_to_image",
  "inpainting",
  "outpainting",
  "background_only",
  "character_only",
] as const;

export type MangaGenerationMode = (typeof MANGA_GENERATION_MODES)[number];

export type MangaQualityEvaluation = {
  projectId: string;
  pageId: string | null;
  panelId: string | null;
  generationJobId: string;
  candidateId: string;
  providerId: string;
  modelId: string;
  generationMode: MangaGenerationMode;
  candidateDisplayed: boolean;
  candidateSelected: boolean;
  selectedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  repaired: boolean;
  repairType: string | null;
  retryCount: number;
  qualityScoreOverall: number | null;
  qualityScoreCharacter: number | null;
  qualityScoreComposition: number | null;
  qualityScoreExpression: number | null;
  qualityScoreBackground: number | null;
  qualityScoreContinuity: number | null;
  failureCategories: MangaQualityFailureCategory[];
  reservedCredits: number | null;
  finalizedCredits: number | null;
  generationLatencyMs: number | null;
  evaluationLatencyMs: number | null;
  actualCostMicros: number | null;
};

export type MangaQualityCandidateEvent = {
  event: "displayed" | "selected" | "rejected";
  generationJobId: string;
  rejectedReason?: string;
};
