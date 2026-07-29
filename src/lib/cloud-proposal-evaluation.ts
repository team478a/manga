import type { CloudProposalQualityIssue } from "./cloud-proposal-quality.ts";

export const proposalEvaluationIssues = [
  "directions_incomplete",
  "required_content_missing",
  "candidates_not_distinct",
  "reference_work_reused",
  "unsupported_number",
  "research_trace_missing",
] as const satisfies readonly CloudProposalQualityIssue[];

export type CloudProposalEvaluationCase = {
  id: string;
  genre: string;
  publicationFormat: "one_shot" | "series";
  generated: boolean;
  issues: CloudProposalQualityIssue[];
};

export type CloudProposalEvaluationThresholds = {
  minimumCases: number;
  minimumGenres: number;
  minimumCasesPerGenre: number;
  minimumCasesPerFormat: number;
  minimumPassRate: number;
  maximumGenerationFailures: number;
  maximumIssues: number;
};

export function evaluateCloudProposalCases(
  cases: CloudProposalEvaluationCase[],
) {
  const issueCounts = Object.fromEntries(
    proposalEvaluationIssues.map((issue) => [issue, 0]),
  ) as Record<CloudProposalQualityIssue, number>;
  const perGenre: Record<string, number> = {};
  const perFormat = { one_shot: 0, series: 0 };
  let passed = 0;
  let generationFailures = 0;

  for (const item of cases) {
    perGenre[item.genre] = (perGenre[item.genre] ?? 0) + 1;
    perFormat[item.publicationFormat] += 1;
    if (!item.generated) generationFailures += 1;
    for (const issue of item.issues) issueCounts[issue] += 1;
    if (item.generated && item.issues.length === 0) passed += 1;
  }

  return {
    total: cases.length,
    passed,
    passRate: cases.length ? passed / cases.length : 0,
    generationFailures,
    totalIssues: Object.values(issueCounts).reduce(
      (total, count) => total + count,
      0,
    ),
    issueCounts,
    perGenre,
    perFormat,
  };
}

export function assessCloudProposalEvaluation(
  evaluation: ReturnType<typeof evaluateCloudProposalCases>,
  thresholds: CloudProposalEvaluationThresholds,
) {
  const failures: string[] = [];
  const genreCounts = Object.values(evaluation.perGenre);
  const formatCounts = Object.values(evaluation.perFormat);

  if (evaluation.total < thresholds.minimumCases)
    failures.push(
      `evaluation.total ${evaluation.total} < ${thresholds.minimumCases}`,
    );
  if (genreCounts.length < thresholds.minimumGenres)
    failures.push(
      `evaluation.genres ${genreCounts.length} < ${thresholds.minimumGenres}`,
    );
  if (
    genreCounts.some((count) => count < thresholds.minimumCasesPerGenre)
  )
    failures.push(
      `evaluation.minimumCasesPerGenre < ${thresholds.minimumCasesPerGenre}`,
    );
  if (
    formatCounts.some((count) => count < thresholds.minimumCasesPerFormat)
  )
    failures.push(
      `evaluation.minimumCasesPerFormat < ${thresholds.minimumCasesPerFormat}`,
    );
  if (evaluation.passRate < thresholds.minimumPassRate)
    failures.push(
      `evaluation.passRate ${evaluation.passRate} < ${thresholds.minimumPassRate}`,
    );
  if (
    evaluation.generationFailures > thresholds.maximumGenerationFailures
  )
    failures.push(
      `evaluation.generationFailures ${evaluation.generationFailures} > ${thresholds.maximumGenerationFailures}`,
    );
  if (evaluation.totalIssues > thresholds.maximumIssues)
    failures.push(
      `evaluation.totalIssues ${evaluation.totalIssues} > ${thresholds.maximumIssues}`,
    );

  return { passed: failures.length === 0, failures };
}
