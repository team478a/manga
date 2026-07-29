import type {
  CloudResearchClaimCandidate,
  CloudResearchClaimExtractionResult,
} from "./cloud-research-claim-extraction.ts";
import type { CloudResearchSourceVerification } from "./cloud-research.ts";

const MAX_COMPARISONS = 6;

const metricKeywords = [
  "市場規模",
  "売上",
  "成長率",
  "価格",
  "単価",
  "利用者",
  "ユーザー",
  "読者",
  "販売数",
  "シェア",
  "market size",
  "sales",
  "growth rate",
  "price",
  "users",
  "readers",
  "share",
] as const;

type Quantity = {
  raw: string;
  value: string;
  unit: string;
};

export type CloudResearchClaimRelation =
  | "corroborates"
  | "potential_conflict"
  | "related"
  | "insufficient";

export type CloudResearchClaimComparison = {
  id: string;
  relation: CloudResearchClaimRelation;
  confidence: "low" | "medium";
  reason: string;
  sharedSignals: string[];
  sharedMetrics: string[];
  sharedYears: string[];
  matchingQuantities: string[];
  conflictingUnits: string[];
  primary: CloudResearchClaimCandidate;
  comparison: CloudResearchClaimCandidate;
};

export type CloudResearchCorroborationSource = {
  verification: CloudResearchSourceVerification;
  textSha256: string;
};

export type CloudResearchCorroborationResult = {
  comparedAt: string;
  independentDomains: boolean;
  primarySource: CloudResearchCorroborationSource;
  comparisonSource: CloudResearchCorroborationSource;
  comparisons: CloudResearchClaimComparison[];
};

function normalizeNumber(value: string) {
  const [integerPart = "0", fractionPart] = value.replace(/,/g, "").split(".");
  const integer = integerPart.replace(/^0+(?=\d)/, "") || "0";
  if (fractionPart === undefined) return integer;
  const fraction = fractionPart.replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

function extractQuantities(text: string) {
  const quantities: Quantity[] = [];
  const pattern =
    /(\d[\d,]*(?:\.\d+)?)\s*(%|％|円|万円|億円|人|件|冊|部|倍)/gu;
  for (const match of text.matchAll(pattern)) {
    quantities.push({
      raw: match[0],
      value: normalizeNumber(match[1]),
      unit: match[2] === "％" ? "%" : match[2],
    });
  }
  return quantities;
}

function extractYears(text: string) {
  return [
    ...new Set(
      [...text.matchAll(/(?:19|20)\d{2}(?=年|\b)/gu)].map(
        (match) => match[0],
      ),
    ),
  ];
}

function extractMetrics(text: string) {
  const normalized = text.toLocaleLowerCase("ja-JP");
  return metricKeywords.filter((metric) =>
    normalized.includes(metric.toLocaleLowerCase("ja-JP")),
  );
}

function intersection(left: readonly string[], right: readonly string[]) {
  const rightSet = new Set(right);
  return [...new Set(left.filter((value) => rightSet.has(value)))];
}

function quantityMap(quantities: Quantity[]) {
  const map = new Map<string, Set<string>>();
  for (const quantity of quantities) {
    const values = map.get(quantity.unit) ?? new Set<string>();
    values.add(quantity.value);
    map.set(quantity.unit, values);
  }
  return map;
}

export function classifyCloudResearchClaimPair(
  primary: CloudResearchClaimCandidate,
  comparison: CloudResearchClaimCandidate,
): CloudResearchClaimComparison {
  const sharedSignals = intersection(primary.signals, comparison.signals);
  const primaryMetrics = extractMetrics(primary.text);
  const comparisonMetrics = extractMetrics(comparison.text);
  const sharedMetrics = intersection(primaryMetrics, comparisonMetrics);
  const primaryYears = extractYears(primary.text);
  const comparisonYears = extractYears(comparison.text);
  const sharedYears = intersection(primaryYears, comparisonYears);
  const yearsCompatible =
    !primaryYears.length ||
    !comparisonYears.length ||
    sharedYears.length > 0;
  const primaryQuantities = quantityMap(extractQuantities(primary.text));
  const comparisonQuantities = quantityMap(
    extractQuantities(comparison.text),
  );
  const matchingQuantities: string[] = [];
  const conflictingUnits: string[] = [];

  for (const [unit, primaryValues] of primaryQuantities) {
    const comparisonValues = comparisonQuantities.get(unit);
    if (!comparisonValues) continue;
    const matches = [...primaryValues].filter((value) =>
      comparisonValues.has(value),
    );
    if (matches.length)
      matchingQuantities.push(
        ...matches.map((value) => `${value}${unit}`),
      );
    else conflictingUnits.push(unit);
  }

  let relation: CloudResearchClaimRelation = "insufficient";
  let confidence: "low" | "medium" = "low";
  let reason = "共通する指標または分野語が不足しています。";

  if (
    sharedSignals.length &&
    sharedMetrics.length &&
    matchingQuantities.length &&
    yearsCompatible
  ) {
    relation = "corroborates";
    confidence = "medium";
    reason = `同じ指標について同じ定量表現（${matchingQuantities.join("、")}）が見つかりました。`;
  } else if (
    sharedMetrics.length &&
    sharedYears.length &&
    conflictingUnits.length
  ) {
    relation = "potential_conflict";
    confidence = "medium";
    reason = `同じ年・指標で${conflictingUnits.join("、")}の値が異なります。母集団と定義を確認してください。`;
  } else if (sharedSignals.length || sharedMetrics.length) {
    relation = "related";
    reason =
      "同じ分野に関連しますが、指標・単位・時点が揃わず直接比較できません。";
  }

  return {
    id: `${primary.id}:${comparison.id}`,
    relation,
    confidence,
    reason,
    sharedSignals,
    sharedMetrics,
    sharedYears,
    matchingQuantities,
    conflictingUnits,
    primary,
    comparison,
  };
}

const relationWeight: Record<CloudResearchClaimRelation, number> = {
  potential_conflict: 4,
  corroborates: 3,
  related: 2,
  insufficient: 1,
};

export function compareCloudResearchClaimCandidates(
  primary: CloudResearchClaimExtractionResult,
  comparison: CloudResearchClaimExtractionResult,
  comparedAt = new Date().toISOString(),
): CloudResearchCorroborationResult {
  const primaryDomain = new URL(
    primary.sourceVerification.finalUrl,
  ).hostname.replace(/^www\./, "");
  const comparisonDomain = new URL(
    comparison.sourceVerification.finalUrl,
  ).hostname.replace(/^www\./, "");
  const comparisons = primary.candidates
    .flatMap((primaryCandidate) =>
      comparison.candidates.map((comparisonCandidate) =>
        classifyCloudResearchClaimPair(primaryCandidate, comparisonCandidate),
      ),
    )
    .filter((item) => item.relation !== "insufficient")
    .sort(
      (left, right) =>
        relationWeight[right.relation] - relationWeight[left.relation] ||
        right.sharedMetrics.length - left.sharedMetrics.length ||
        right.sharedSignals.length - left.sharedSignals.length ||
        right.primary.score +
          right.comparison.score -
          (left.primary.score + left.comparison.score) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, MAX_COMPARISONS);

  return {
    comparedAt,
    independentDomains: primaryDomain !== comparisonDomain,
    primarySource: {
      verification: primary.sourceVerification,
      textSha256: primary.textSha256,
    },
    comparisonSource: {
      verification: comparison.sourceVerification,
      textSha256: comparison.textSha256,
    },
    comparisons,
  };
}
