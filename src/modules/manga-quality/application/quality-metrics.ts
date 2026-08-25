import type { MangaQualityEvaluation } from "../domain/quality-evaluation-log";

export type MangaQualityMetrics = {
  candidates: number;
  displayedCandidates: number;
  selectedCandidates: number;
  initialSelectionRate: number;
  averageRetryCount: number;
  averageRepairCount: number;
  failureCategoryRates: Record<string, number>;
  providerSelectionRates: Record<string, number>;
  modelSelectionRates: Record<string, number>;
  averageAiCostMicrosPerPage: number;
  averageCostMicrosPerSelectedPanel: number;
  averageCompletionTimeMs: number;
  majorCharacterMismatchRate: number;
  generationFailureRate: number;
};

const ratio = (count: number, total: number) =>
  total === 0 ? 0 : count / total;

function selectionRates(
  rows: MangaQualityEvaluation[],
  key: "providerId" | "modelId",
) {
  const groups = new Map<string, MangaQualityEvaluation[]>();
  for (const row of rows)
    groups.set(row[key], [...(groups.get(row[key]) ?? []), row]);
  return Object.fromEntries(
    [...groups].map(([name, candidates]) => [
      name,
      ratio(
        candidates.filter((candidate) => candidate.candidateSelected).length,
        candidates.filter((candidate) => candidate.candidateDisplayed).length,
      ),
    ]),
  );
}

export function calculateMangaQualityMetrics(
  rows: MangaQualityEvaluation[],
): MangaQualityMetrics {
  const failureCounts = new Map<string, number>();
  for (const row of rows)
    for (const category of new Set(row.failureCategories))
      failureCounts.set(category, (failureCounts.get(category) ?? 0) + 1);
  const displayedCandidates = rows.filter(
    (row) => row.candidateDisplayed,
  ).length;
  const selectedCandidates = rows.filter(
    (row) => row.candidateSelected,
  ).length;
  const selectedPanelCosts = rows.filter(
    (row) => row.candidateSelected && row.actualCostMicros !== null,
  );
  const completedCandidates = rows.filter(
    (row) => row.generationLatencyMs !== null,
  );
  const majorCharacterMismatches = rows.filter((row) =>
    row.failureCategories.some((category) =>
      ["face_mismatch", "wrong_character_count", "continuity_break"].includes(category),
    ),
  ).length;
  const pageCosts = new Map<string, number>();
  for (const row of rows) {
    if (!row.pageId || row.actualCostMicros === null) continue;
    pageCosts.set(
      row.pageId,
      (pageCosts.get(row.pageId) ?? 0) + row.actualCostMicros,
    );
  }
  return {
    candidates: rows.length,
    displayedCandidates,
    selectedCandidates,
    initialSelectionRate: ratio(selectedCandidates, displayedCandidates),
    averageRetryCount: ratio(
      rows.reduce((sum, row) => sum + row.retryCount, 0),
      rows.length,
    ),
    averageRepairCount: ratio(
      rows.filter((row) => row.repaired).length,
      rows.length,
    ),
    failureCategoryRates: Object.fromEntries(
      [...failureCounts].map(([category, count]) => [
        category,
        ratio(count, rows.length),
      ]),
    ),
    providerSelectionRates: selectionRates(rows, "providerId"),
    modelSelectionRates: selectionRates(rows, "modelId"),
    averageAiCostMicrosPerPage: ratio(
      [...pageCosts.values()].reduce((sum, cost) => sum + cost, 0),
      pageCosts.size,
    ),
    averageCostMicrosPerSelectedPanel: ratio(
      selectedPanelCosts.reduce((sum, row) => sum + (row.actualCostMicros ?? 0), 0),
      selectedPanelCosts.length,
    ),
    averageCompletionTimeMs: ratio(
      completedCandidates.reduce(
        (sum, row) => sum + (row.generationLatencyMs ?? 0) + (row.evaluationLatencyMs ?? 0),
        0,
      ),
      completedCandidates.length,
    ),
    majorCharacterMismatchRate: ratio(majorCharacterMismatches, rows.length),
    generationFailureRate: ratio(
      rows.filter((row) => row.rejectedReason === "generation_failed").length,
      rows.length,
    ),
  };
}
