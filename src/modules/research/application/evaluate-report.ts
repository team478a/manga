import type { CloudResearchClaimRelation } from "./compare-claims.ts";
import type { CloudResearchTopic } from "../domain/research-report.ts";

export const researchRelations = [
  "corroborates",
  "potential_conflict",
  "related",
  "insufficient",
] as const satisfies readonly CloudResearchClaimRelation[];

export const researchTopics = [
  "demand",
  "competition",
  "audience",
  "theme",
  "price",
  "channel",
  "risk",
] as const satisfies readonly CloudResearchTopic[];

export type ClassificationEvaluationCase = {
  id: string;
  expected: CloudResearchClaimRelation;
  actual: CloudResearchClaimRelation;
};

export type ExtractionEvaluationCase = {
  id: string;
  topic: CloudResearchTopic;
  expectedHit: boolean;
  forbiddenLeak: boolean;
};

type RelationMetrics = {
  support: number;
  predicted: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
};

function ratio(
  numerator: number,
  denominator: number,
  emptyValue = 0,
) {
  return denominator === 0 ? emptyValue : numerator / denominator;
}

function harmonicMean(precision: number, recall: number) {
  return precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);
}

export function evaluateClassifications(
  cases: readonly ClassificationEvaluationCase[],
) {
  const confusionMatrix = Object.fromEntries(
    researchRelations.map((expected) => [
      expected,
      Object.fromEntries(researchRelations.map((actual) => [actual, 0])),
    ]),
  ) as Record<
    CloudResearchClaimRelation,
    Record<CloudResearchClaimRelation, number>
  >;

  let correct = 0;
  for (const item of cases) {
    confusionMatrix[item.expected][item.actual] += 1;
    if (item.expected === item.actual) correct += 1;
  }

  const perRelation = Object.fromEntries(
    researchRelations.map((relation) => {
      const support = cases.filter(
        (item) => item.expected === relation,
      ).length;
      const predicted = cases.filter(
        (item) => item.actual === relation,
      ).length;
      const truePositive = confusionMatrix[relation][relation];
      const falsePositive = predicted - truePositive;
      const falseNegative = support - truePositive;
      const precision = ratio(truePositive, predicted, 1);
      const recall = ratio(truePositive, support, 1);
      return [
        relation,
        {
          support,
          predicted,
          truePositive,
          falsePositive,
          falseNegative,
          precision,
          recall,
          f1: harmonicMean(precision, recall),
        } satisfies RelationMetrics,
      ];
    }),
  ) as Record<CloudResearchClaimRelation, RelationMetrics>;

  return {
    total: cases.length,
    correct,
    accuracy: ratio(correct, cases.length),
    macroF1:
      researchRelations.reduce(
        (sum, relation) => sum + perRelation[relation].f1,
        0,
      ) / researchRelations.length,
    perRelation,
    confusionMatrix,
  };
}

export function evaluateExtractions(
  cases: readonly ExtractionEvaluationCase[],
) {
  const hits = cases.filter((item) => item.expectedHit).length;
  const leakedCases = cases.filter((item) => item.forbiddenLeak).length;
  const perTopic = Object.fromEntries(
    researchTopics.map((topic) => {
      const topicCases = cases.filter((item) => item.topic === topic);
      const topicHits = topicCases.filter((item) => item.expectedHit).length;
      return [
        topic,
        {
          total: topicCases.length,
          hits: topicHits,
          top3HitRate: ratio(topicHits, topicCases.length),
        },
      ];
    }),
  ) as Record<
    CloudResearchTopic,
    { total: number; hits: number; top3HitRate: number }
  >;

  return {
    total: cases.length,
    hits,
    top3HitRate: ratio(hits, cases.length),
    leakedCases,
    forbiddenLeakRate: ratio(leakedCases, cases.length),
    perTopic,
  };
}

export type ResearchEvaluationThresholds = {
  minimumExtractionCases: number;
  minimumCasesPerTopic: number;
  minimumTop3HitRate: number;
  maximumForbiddenLeaks: number;
  minimumClassificationCases: number;
  minimumCasesPerRelation: number;
  minimumAccuracy: number;
  minimumMacroF1: number;
  minimumConflictPrecision: number;
  minimumConflictRecall: number;
  minimumCorroboratesPrecision: number;
  minimumCorroboratesRecall: number;
};

export function assessResearchEvaluation(
  extraction: ReturnType<typeof evaluateExtractions>,
  classification: ReturnType<typeof evaluateClassifications>,
  thresholds: ResearchEvaluationThresholds,
) {
  const failures: string[] = [];
  const requireAtLeast = (
    label: string,
    actual: number,
    minimum: number,
  ) => {
    if (actual < minimum)
      failures.push(`${label}: ${actual} < ${minimum}`);
  };

  requireAtLeast(
    "extraction.total",
    extraction.total,
    thresholds.minimumExtractionCases,
  );
  requireAtLeast(
    "extraction.top3HitRate",
    extraction.top3HitRate,
    thresholds.minimumTop3HitRate,
  );
  if (extraction.leakedCases > thresholds.maximumForbiddenLeaks)
    failures.push(
      `extraction.leakedCases: ${extraction.leakedCases} > ${thresholds.maximumForbiddenLeaks}`,
    );
  for (const topic of researchTopics)
    requireAtLeast(
      `extraction.perTopic.${topic}.total`,
      extraction.perTopic[topic].total,
      thresholds.minimumCasesPerTopic,
    );

  requireAtLeast(
    "classification.total",
    classification.total,
    thresholds.minimumClassificationCases,
  );
  requireAtLeast(
    "classification.accuracy",
    classification.accuracy,
    thresholds.minimumAccuracy,
  );
  requireAtLeast(
    "classification.macroF1",
    classification.macroF1,
    thresholds.minimumMacroF1,
  );
  for (const relation of researchRelations)
    requireAtLeast(
      `classification.perRelation.${relation}.support`,
      classification.perRelation[relation].support,
      thresholds.minimumCasesPerRelation,
    );
  requireAtLeast(
    "classification.potential_conflict.precision",
    classification.perRelation.potential_conflict.precision,
    thresholds.minimumConflictPrecision,
  );
  requireAtLeast(
    "classification.potential_conflict.recall",
    classification.perRelation.potential_conflict.recall,
    thresholds.minimumConflictRecall,
  );
  requireAtLeast(
    "classification.corroborates.precision",
    classification.perRelation.corroborates.precision,
    thresholds.minimumCorroboratesPrecision,
  );
  requireAtLeast(
    "classification.corroborates.recall",
    classification.perRelation.corroborates.recall,
    thresholds.minimumCorroboratesRecall,
  );

  return { passed: failures.length === 0, failures };
}
