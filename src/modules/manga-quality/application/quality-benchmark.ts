import type {
  CandidateAsset,
  MangaVisualJudge,
  PreviousNextPanelContext,
  ReferenceAsset,
} from "./manga-visual-judge.ts";
import type { QualityBenchmarkFixture } from "../domain/quality-benchmark-fixture.ts";
import {
  BASE_REQUIRED_EVIDENCE_KEYS,
  calculateQualityCoverage,
  type VisualEvidenceResult,
} from "../domain/visual-evidence.ts";

export type QualityBenchmarkCase = {
  fixture: QualityBenchmarkFixture;
  candidateAsset: CandidateAsset;
  referenceAssets: ReferenceAsset[];
  context?: PreviousNextPanelContext;
};

export type QualityBenchmarkObservation = {
  fixture: QualityBenchmarkFixture;
  result: VisualEvidenceResult;
  continuityRequired: boolean;
};

function categoryAgreement(
  expected: readonly string[],
  actual: readonly string[],
) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const union = new Set([...expectedSet, ...actualSet]);
  if (!union.size) return 1;
  return (
    [...union].filter((category) => expectedSet.has(category) && actualSet.has(category))
      .length / union.size
  );
}

export function calculateQualityBenchmarkMetrics(
  observations: readonly QualityBenchmarkObservation[],
) {
  if (!observations.length)
    throw new Error("quality_benchmark_observations_required");
  const critical = observations.filter(
    ({ fixture }) => fixture.labels.severity === "critical",
  );
  const adoptable = observations.filter(
    ({ fixture }) => fixture.labels.adoptable,
  );
  const requiredEvidenceStatuses = observations.flatMap(
    ({ result, continuityRequired }) => [
      ...BASE_REQUIRED_EVIDENCE_KEYS.map(
        (key) => result.evidence[key].status,
      ),
      ...(continuityRequired ? [result.evidence.continuityMatch.status] : []),
    ],
  );
  const coverages = observations.map(({ result, continuityRequired }) =>
    calculateQualityCoverage(result.evidence, { continuityRequired }),
  );
  const knownCosts = observations
    .map(({ result }) => result.estimatedJudgeCostMicros)
    .filter((cost): cost is number => cost !== null);
  const knownLatencies = observations
    .map(({ result }) => result.latencyMs)
    .filter((latency): latency is number => latency !== null);
  return {
    fixtureCount: observations.length,
    criticalFailureRecall: critical.length
      ? critical.filter(({ result }) => result.criticalFailure).length /
        critical.length
      : null,
    falsePositiveRate: adoptable.length
      ? adoptable.filter(({ result }) => result.criticalFailure).length /
        adoptable.length
      : null,
    failureCategoryAgreement:
      observations.reduce(
        (sum, { fixture, result }) =>
          sum +
          categoryAgreement(
            fixture.labels.failureCategories,
            result.suggestedFailureCategories,
          ),
        0,
      ) / observations.length,
    requiredEvidenceUnknownRate:
      requiredEvidenceStatuses.filter((status) => status !== "ok").length /
      requiredEvidenceStatuses.length,
    averageEvidenceCoverage:
      coverages.reduce((sum, coverage) => sum + coverage.evidenceCoverage, 0) /
      coverages.length,
    completeRequiredEvidenceRate:
      coverages.filter((coverage) => coverage.requiredEvidenceComplete).length /
      coverages.length,
    averageJudgeCostMicros: knownCosts.length
      ? knownCosts.reduce((sum, cost) => sum + cost, 0) / knownCosts.length
      : null,
    judgeCostCoverage: knownCosts.length / observations.length,
    averageLatencyMs: knownLatencies.length
      ? knownLatencies.reduce((sum, latency) => sum + latency, 0) /
        knownLatencies.length
      : null,
    latencyCoverage: knownLatencies.length / observations.length,
  };
}

export async function runQualityBenchmark(input: {
  judge: MangaVisualJudge;
  cases: readonly QualityBenchmarkCase[];
}) {
  const observations: QualityBenchmarkObservation[] = [];
  for (const benchmarkCase of input.cases) {
    const result = await input.judge.evaluate({
      panelSpecification: benchmarkCase.fixture.panelSpecification,
      candidateAsset: benchmarkCase.candidateAsset,
      referenceAssets: benchmarkCase.referenceAssets,
      context: benchmarkCase.context,
    });
    observations.push({
      fixture: benchmarkCase.fixture,
      result,
      continuityRequired: Boolean(benchmarkCase.context),
    });
  }
  return {
    judge: input.judge.descriptor,
    observations,
    metrics: calculateQualityBenchmarkMetrics(observations),
  };
}
