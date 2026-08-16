import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateQualityBenchmarkMetrics } from "../src/modules/manga-quality/application/quality-benchmark.ts";
import { inspectQualityBenchmarkReadiness, qualityBenchmarkManifestSchema } from "../src/modules/manga-quality/domain/quality-benchmark-fixture.ts";
import { calculateQualityCoverage, evidenceValueSchema, toQualityScore, visualEvidenceResultSchema } from "../src/modules/manga-quality/domain/visual-evidence.ts";
import { visualJudgeFailureCompatibilityMap } from "../src/modules/manga-quality/domain/visual-judge-failure.ts";

const panelSpecification = {
  version: 1,
  panelId: "00000000-0000-4000-8000-000000000043",
  characterNames: ["主人公"],
  expectedCharacterCount: 1,
  expression: "驚き",
  composition: "人物を中景で捉える",
  background: "駅のホーム",
  props: [],
  action: "振り返る",
  shot: "medium",
  cameraAngle: "eye_level",
  generationTarget: "composite",
};

function makeEvidence(status = "ok") {
  const value = {
    status,
    score: status === "ok" ? 0.8 : null,
    confidence: status === "ok" ? 0.9 : 0,
    source: "mock",
  };
  return {
    characterMatch: { ...value, source: "rule" },
    expressionMatch: { ...value, source: "rule" },
    compositionMatch: { ...value, source: "rule" },
    backgroundMatch: { ...value, source: "rule" },
    propMatch: { ...value, source: "rule" },
    anatomyQuality: { ...value, source: "rule" },
    orientationQuality: { ...value, source: "rule" },
    textArtifactRisk: { ...value, source: "rule" },
    styleConsistency: { ...value, source: "rule" },
    continuityMatch: { ...value, source: "rule" },
    detectedCharacterCount: {
      ...value,
      source: "rule",
      detectedCount: status === "ok" ? 1 : null,
    },
  };
}

function makeFixture(index, options = {}) {
  return {
    id: `fixture-${String(index).padStart(2, "0")}`,
    asset: {
      path: `assets/fixture-${String(index).padStart(2, "0")}.png`,
      sha256: "a".repeat(64),
      mimeType: "image/png",
      width: 1024,
      height: 1536,
    },
    panelSpecification: {
      ...panelSpecification,
      panelId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    },
    labels: {
      adoptable: options.adoptable ?? true,
      failureCategories: options.failureCategories ?? [],
      severity: options.severity ?? "minor",
    },
  };
}

function makeResult(options = {}) {
  return visualEvidenceResultSchema.parse({
    version: 1,
    judgeId: "mock-v1",
    evidence: options.evidence ?? makeEvidence(),
    suggestedFailureCategories: options.categories ?? [],
    criticalFailure: options.criticalFailure ?? false,
    estimatedJudgeCostMicros: options.cost === undefined ? 100 : options.cost,
    latencyMs: options.latency === undefined ? 200 : options.latency,
  });
}

test("unknown evidence cannot be converted into a neutral score", () => {
  assert.equal(evidenceValueSchema.safeParse({
    status: "unknown",
    score: 0.75,
    confidence: 0,
    source: "rule",
  }).success, false);
  assert.equal(evidenceValueSchema.parse({
    status: "unknown",
    score: null,
    confidence: 0,
    source: "rule",
  }).score, null);
  assert.equal(toQualityScore(0.8234), 82.34);
});

test("coverage excludes optional continuity and preserves required unknowns", () => {
  const evidence = makeEvidence();
  evidence.anatomyQuality = {
    status: "not_evaluated",
    score: null,
    confidence: 0,
    source: "rule",
  };
  const withoutContinuity = calculateQualityCoverage(evidence);
  const withContinuity = calculateQualityCoverage(evidence, {
    continuityRequired: true,
  });
  assert.equal(withoutContinuity.totalExpectedCount, 10);
  assert.equal(withoutContinuity.evaluatedCount, 9);
  assert.equal(withoutContinuity.requiredEvidenceComplete, false);
  assert.equal(withContinuity.totalExpectedCount, 11);
});

test("empty private manifest reports every fixture shortage", () => {
  const manifest = qualityBenchmarkManifestSchema.parse({
    version: 1,
    datasetId: "r4-3a-private-fixture",
    fixtureUse: "private-local",
    fixtures: [],
  });
  const readiness = inspectQualityBenchmarkReadiness(manifest);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.missingTotalCases, 30);
  assert.equal(readiness.missingAdoptableCases, 15);
  assert.deepEqual(Object.values(readiness.missingCategoryCases), [5, 5, 5, 5, 5, 5]);
});

test("fixture assets cannot escape the private assets directory", () => {
  const fixture = makeFixture(1);
  fixture.asset.path = "assets/../production.png";
  assert.equal(qualityBenchmarkManifestSchema.safeParse({
    version: 1,
    datasetId: "private-path-contract",
    fixtureUse: "private-local",
    fixtures: [fixture],
  }).success, false);
});

test("30 labeled cases satisfy the metadata readiness contract", () => {
  const failureCategories = [
    "character_mismatch",
    "body_distortion",
    "text_artifact",
    "crop_mismatch",
    "orientation_error",
    "wrong_background",
  ];
  const fixtures = Array.from({ length: 30 }, (_, index) =>
    index < 15
      ? makeFixture(index + 1)
      : makeFixture(index + 1, {
          adoptable: false,
          failureCategories,
          severity: "major",
        }),
  );
  const manifest = qualityBenchmarkManifestSchema.parse({
    version: 1,
    datasetId: "contract-only-fixture",
    fixtureUse: "private-local",
    fixtures,
  });
  assert.equal(inspectQualityBenchmarkReadiness(manifest).ready, true);
});

test("benchmark metrics keep critical recall, false positives, cost, and latency separate", () => {
  const observations = [
    {
      fixture: makeFixture(1, {
        adoptable: false,
        failureCategories: ["body_distortion"],
        severity: "critical",
      }),
      result: makeResult({
        categories: ["body_distortion"],
        criticalFailure: true,
        cost: 120,
        latency: 300,
      }),
      continuityRequired: false,
    },
    {
      fixture: makeFixture(2),
      result: makeResult({ cost: null, latency: null }),
      continuityRequired: false,
    },
  ];
  const metrics = calculateQualityBenchmarkMetrics(observations);
  assert.equal(metrics.criticalFailureRecall, 1);
  assert.equal(metrics.falsePositiveRate, 0);
  assert.equal(metrics.failureCategoryAgreement, 1);
  assert.equal(metrics.averageJudgeCostMicros, 120);
  assert.equal(metrics.judgeCostCoverage, 0.5);
  assert.equal(metrics.averageLatencyMs, 300);
  assert.equal(metrics.latencyCoverage, 0.5);
});

test("visual failure vocabulary stays compatible without changing runtime categories", () => {
  assert.equal(visualJudgeFailureCompatibilityMap.text_artifact, "text_area_collision");
  assert.equal(visualJudgeFailureCompatibilityMap.orientation_error, "other");
});

test("provider-neutral judge boundary imports no external provider SDK", async () => {
  const source = await readFile(
    new URL("../src/modules/manga-quality/application/manga-visual-judge.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /openai|anthropic|google|gemini/i);
});
