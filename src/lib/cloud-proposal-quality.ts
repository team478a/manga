import type {
  CloudStoryProposalCandidate,
  CloudStoryProposalResult,
} from "./cloud-proposal.ts";
import type {
  CloudResearchFinding,
  CloudResearchInput,
} from "./cloud-research.ts";

export type CloudProposalQualityIssue =
  | "directions_incomplete"
  | "required_content_missing"
  | "candidates_not_distinct"
  | "reference_work_reused"
  | "unsupported_number"
  | "research_trace_missing";

export type CloudProposalQualityResult = {
  passed: boolean;
  issues: CloudProposalQualityIssue[];
};

const requiredDirections = ["balanced", "differentiated", "focused"] as const;
const requiredFindingKeys = [
  "reader_persona",
  "popular_themes",
  "differentiation",
  "risks",
  "next_proposal",
] as const;

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/\s+/g, "");
}

function candidateCore(candidate: CloudStoryProposalCandidate) {
  return [
    candidate.title,
    candidate.logline,
    candidate.protagonist,
    candidate.centralConflict,
    candidate.setting,
    candidate.differentiation,
    candidate.formatPlan,
    candidate.salesPositioning,
    ...candidate.risks,
  ].join("\n");
}

function unique(values: string[]) {
  return new Set(values.map(normalize)).size === values.length;
}

function numbers(value: string) {
  return [...value.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
    match[0].replaceAll(",", ""),
  );
}

function referenceNames(input: CloudResearchInput) {
  return input.referenceWorks
    .split(/[\n,、，／/]+/)
    .map((value) => normalize(value))
    .filter((value) => value.length >= 2);
}

export function evaluateCloudProposalQuality(
  result: CloudStoryProposalResult,
  input: CloudResearchInput,
  findings: CloudResearchFinding[] = [],
): CloudProposalQualityResult {
  const issues = new Set<CloudProposalQualityIssue>();
  const directions = result.candidates.map((candidate) => candidate.direction);
  if (
    result.candidates.length !== requiredDirections.length ||
    requiredDirections.some(
      (direction) =>
        directions.filter((candidateDirection) => candidateDirection === direction)
          .length !== 1,
    )
  ) {
    issues.add("directions_incomplete");
  }

  if (
    result.candidates.some((candidate) =>
      [
        candidate.title,
        candidate.logline,
        candidate.readerPromise,
        candidate.protagonist,
        candidate.centralConflict,
        candidate.setting,
        candidate.differentiation,
      ].some((value) => normalize(value).length < 4),
    )
  ) {
    issues.add("required_content_missing");
  }

  for (const field of [
    "title",
    "logline",
    "centralConflict",
    "differentiation",
  ] as const) {
    if (!unique(result.candidates.map((candidate) => candidate[field]))) {
      issues.add("candidates_not_distinct");
    }
  }

  const references = referenceNames(input);
  if (
    references.length &&
    result.candidates.some((candidate) => {
      const protectedFields = normalize(
        [candidate.title, candidate.protagonist, candidate.setting].join("\n"),
      );
      return references.some((reference) => protectedFields.includes(reference));
    })
  ) {
    issues.add("reference_work_reused");
  }

  const allowedNumbers = new Set(
    numbers(
      JSON.stringify({
        input,
        findings: findings.map((finding) => finding.summary),
      }),
    ),
  );
  if (
    result.candidates.some((candidate) =>
      numbers(candidateCore(candidate)).some(
        (value) => !allowedNumbers.has(value),
      ),
    )
  ) {
    issues.add("unsupported_number");
  }

  if (
    result.candidates.some(
      (candidate) =>
        candidate.sourceUrls.length === 0 ||
        requiredFindingKeys.some(
          (key) => !candidate.researchFindingKeys.includes(key),
        ),
    )
  ) {
    issues.add("research_trace_missing");
  }

  return {
    passed: issues.size === 0,
    issues: [...issues],
  };
}
