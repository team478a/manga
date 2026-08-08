import type { MangaQualityFailureCategory } from "../domain/failure-category.ts";
import type { PanelSpecification } from "../domain/panel-specification.ts";
import {
  evaluateCharacterConsistency,
  type CharacterIdentityEvidence,
} from "../domain/character-consistency.ts";
import {
  classifyPanelQuality,
  panelQualityEvaluationSchema,
  type PanelQualityEvaluation,
  type PanelQualityScores,
} from "../domain/panel-quality-score.ts";

export type PanelCandidateEvidence = {
  assetAvailable: boolean;
  expectedWidth?: number;
  expectedHeight?: number;
  actualWidth?: number;
  actualHeight?: number;
  detectedCharacterCount?: number;
  characterMatch?: number;
  expressionMatch?: number;
  compositionMatch?: number;
  backgroundMatch?: number;
  propMatch?: number;
  anatomyQuality?: number;
  continuityMatch?: number;
  characterIdentityEvidence?: CharacterIdentityEvidence[];
};

const neutral = (value: number | undefined) => value ?? 75;
const round = (value: number) => Math.round(value * 100) / 100;

export function evaluatePanelCandidate(
  specification: PanelSpecification,
  evidence: PanelCandidateEvidence,
): PanelQualityEvaluation {
  const failures = new Set<MangaQualityFailureCategory>();
  const identityConsistency = evaluateCharacterConsistency(
    specification.characterIdentities,
    evidence.characterIdentityEvidence ?? [],
  );
  const identityMismatches = identityConsistency.characters.flatMap(
    (character) => character.mismatchedAttributes,
  );
  if (!evidence.assetAvailable) failures.add("low_readability");
  if (
    evidence.detectedCharacterCount !== undefined &&
    evidence.detectedCharacterCount !== specification.expectedCharacterCount
  ) failures.add("wrong_character_count");
  if ((evidence.expressionMatch ?? 100) < 60) failures.add("wrong_expression");
  if ((evidence.compositionMatch ?? 100) < 60) failures.add("wrong_camera");
  if ((evidence.backgroundMatch ?? 100) < 60) failures.add("wrong_background");
  if ((evidence.propMatch ?? 100) < 60) failures.add("missing_prop");
  if ((evidence.anatomyQuality ?? 100) < 60) failures.add("body_distortion");
  if ((evidence.continuityMatch ?? 100) < 60) failures.add("continuity_break");
  if (identityMismatches.length) failures.add("continuity_break");
  if (
    identityMismatches.some((attribute) =>
      ["faceSummary", "hairStyle", "hairColor", "eyeColor"].includes(attribute),
    )
  ) failures.add("face_mismatch");

  let compositionScore = neutral(evidence.compositionMatch);
  if (
    evidence.expectedWidth && evidence.expectedHeight &&
    evidence.actualWidth && evidence.actualHeight
  ) {
    const expectedRatio = evidence.expectedWidth / evidence.expectedHeight;
    const actualRatio = evidence.actualWidth / evidence.actualHeight;
    const ratioScore = Math.max(0, 100 - Math.abs(expectedRatio - actualRatio) * 100);
    compositionScore = round((compositionScore + ratioScore) / 2);
  }
  const scores: Omit<PanelQualityScores, "overallScore"> = {
    characterMatchScore: identityConsistency.semanticEvidenceAvailable
      ? evidence.characterMatch === undefined
        ? identityConsistency.overallScore
        : round((evidence.characterMatch + identityConsistency.overallScore) / 2)
      : neutral(evidence.characterMatch),
    expressionScore: neutral(evidence.expressionMatch),
    compositionScore,
    backgroundScore: neutral(evidence.backgroundMatch),
    propScore: neutral(evidence.propMatch),
    anatomyScore: neutral(evidence.anatomyQuality),
    continuityHintScore: neutral(evidence.continuityMatch),
  };
  const values = Object.values(scores);
  const overallScore = evidence.assetAvailable
    ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
  return panelQualityEvaluationSchema.parse({
    specificationVersion: specification.version,
    scores: { ...scores, overallScore },
    failureCategories: [...failures],
    displayBand: classifyPanelQuality(overallScore),
    evidence: {
      evaluatedFields: Object.entries(evidence)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key),
      semanticEvidenceAvailable:
        evidence.detectedCharacterCount !== undefined ||
        identityConsistency.semanticEvidenceAvailable,
      characterConsistency: identityConsistency,
    },
  });
}

export function rankPanelCandidates<T extends { created_at: string; id: string }>(
  candidates: T[],
  scoreByJobId: ReadonlyMap<string, number>,
) {
  return [...candidates].sort((left, right) => {
    const scoreDifference = (scoreByJobId.get(right.id) ?? -1) - (scoreByJobId.get(left.id) ?? -1);
    if (scoreDifference) return scoreDifference;
    const timeDifference = Date.parse(right.created_at) - Date.parse(left.created_at);
    return timeDifference || left.id.localeCompare(right.id);
  });
}
