import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateQualityBenchmarkMetrics } from "../src/modules/manga-quality/application/quality-benchmark.ts";
import {
  inspectQualityBenchmarkReadiness,
  qualityBenchmarkCaseSchema,
  qualityBenchmarkCasesSchema,
  qualityBenchmarkIntendedSchema,
  qualityBenchmarkManifestSchema,
  qualityBenchmarkPrivateLabelsSchema,
} from "../src/modules/manga-quality/domain/quality-benchmark-fixture.ts";
import { calculateQualityCoverage, evidenceValueSchema, toQualityScore, visualEvidenceResultSchema } from "../src/modules/manga-quality/domain/visual-evidence.ts";
import { toExactRuntimeFailureCategory } from "../src/modules/manga-quality/domain/visual-judge-failure.ts";

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

const defectCategories = [
  "character_identity_mismatch",
  "anatomy_object_fusion",
  "unwanted_text_ui_logo",
  "composition_crop_error",
  "orientation_gravity_error",
  "background_prop_mismatch",
];

function makeBenchmarkPackage(split, start, targets) {
  const verdicts = [
    ...Array(targets.good).fill("good"),
    ...Array(targets.bad).fill("bad"),
    ...Array(targets.borderline).fill("borderline"),
  ];
  const images = verdicts.map((_, index) => {
    const id = `img_${String(start + index).padStart(4, "0")}`;
    return {
      id,
      file: `images/${id}.png`,
      sha256: (start + index).toString(16).padStart(64, "0"),
      image_profile_id: "portrait_704x1024",
    };
  });
  const manifest = qualityBenchmarkManifestSchema.parse({
    benchmark_version: "2.1",
    dataset_id: `r4-3a-${split.replace("_", "-")}`,
    suite: "candidate",
    split,
    review_version: "human-v2.1",
    image_profiles: [{
      id: "portrait_704x1024",
      width: 704,
      height: 1024,
      source: "production_pipeline",
    }],
    images,
  });
  const cases = qualityBenchmarkCasesSchema.parse(
    images.map((image) => ({
      id: image.id,
      file: image.file,
      suite: "candidate",
      judge_mode: "intrinsic",
      image_profile_id: image.image_profile_id,
      refs: [],
      intended: `intended/${image.id}.json`,
    })),
  );
  let badIndex = 0;
  const privateLabels = qualityBenchmarkPrivateLabelsSchema.parse(
    images.map((image, index) => {
      const verdict = verdicts[index];
      const category = defectCategories[badIndex++ % defectCategories.length];
      return {
        id: image.id,
        verdict,
        defects: verdict === "bad" ? [{ category, severity: "major" }] : [],
        reviewed_by: ["reviewer-a", "reviewer-b"],
        reviewed_at: "2026-08-16",
      };
    }),
  );
  return { manifest, cases, privateLabels };
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

test("public candidate cases reject labels and unsafe paths", () => {
  assert.equal(qualityBenchmarkCaseSchema.safeParse({
    id: "img_0001",
    file: "images/img_0001.png",
    suite: "candidate",
    judge_mode: "intrinsic",
    image_profile_id: "portrait_704x1024",
    refs: [],
    intended: "intended/img_0001.json",
    verdict: "good",
  }).success, false);
  assert.equal(qualityBenchmarkCaseSchema.safeParse({
    id: "img_0001",
    file: "images/../good.png",
    suite: "candidate",
    judge_mode: "intrinsic",
    image_profile_id: "portrait_704x1024",
    refs: [],
    intended: "intended/img_0001.json",
  }).success, false);
});

test("referential cases require references while intrinsic cases forbid them", () => {
  const base = {
    id: "img_0001",
    file: "images/img_0001.png",
    suite: "candidate",
    image_profile_id: "portrait_704x1024",
    intended: "intended/img_0001.json",
  };
  assert.equal(qualityBenchmarkCaseSchema.safeParse({ ...base, judge_mode: "referential", refs: [] }).success, false);
  assert.equal(qualityBenchmarkCaseSchema.safeParse({ ...base, judge_mode: "intrinsic", refs: ["refs/ref_01.png"] }).success, false);
});

test("private labels require two unique reviewers", () => {
  const labels = [{
      id: "img_0001",
      verdict: "bad",
      defects: [{ category: "anatomy_object_fusion", severity: "major" }],
      reviewed_by: ["reviewer-a"],
      reviewed_at: "2026-08-16",
    }];
  assert.equal(qualityBenchmarkPrivateLabelsSchema.safeParse(labels).success, false);
  labels[0].reviewed_by.push("reviewer-b");
  assert.equal(qualityBenchmarkPrivateLabelsSchema.safeParse(labels).success, true);
});

test("intended contract embeds the current Panel Specification schema", () => {
  assert.equal(qualityBenchmarkIntendedSchema.safeParse({
    schemaVersion: 1,
    panelSpecification,
    referenceBindings: [],
  }).success, true);
});

test("checked-in examples match the canonical snake_case array contract", async () => {
  const root = new URL("./fixtures/manga-quality/examples/", import.meta.url);
  const readExample = async (name) => JSON.parse(await readFile(new URL(name, root), "utf8"));
  assert.equal(qualityBenchmarkManifestSchema.safeParse(await readExample("manifest.dev.example.json")).success, true);
  assert.equal(qualityBenchmarkCasesSchema.safeParse(await readExample("cases.example.json")).success, true);
  assert.equal(qualityBenchmarkPrivateLabelsSchema.safeParse(await readExample("labels.private.example.json")).success, true);
  assert.equal(qualityBenchmarkIntendedSchema.safeParse(await readExample("intended.example.json")).success, true);
});

test("v2.1 exact dev and private holdout targets satisfy structural readiness", () => {
  const dev = makeBenchmarkPackage("dev", 1, { good: 48, bad: 48, borderline: 16 });
  const holdout = makeBenchmarkPackage("holdout_private", 201, { good: 12, bad: 12, borderline: 4 });
  const readiness = inspectQualityBenchmarkReadiness({ dev, holdout });
  assert.equal(readiness.ready, true);
  assert.equal(readiness.noCrossSplitDuplicates, true);
  assert.equal(readiness.dev.independentReviewReady, true);
  assert.deepEqual(Object.values(readiness.categoryCounts), [10, 10, 10, 10, 10, 10]);
});

test("v2.1 readiness rejects cross-split exact duplicates", () => {
  const dev = makeBenchmarkPackage("dev", 1, { good: 48, bad: 48, borderline: 16 });
  const holdout = makeBenchmarkPackage("holdout_private", 201, { good: 12, bad: 12, borderline: 4 });
  holdout.manifest.images[0].sha256 = dev.manifest.images[0].sha256;
  assert.equal(inspectQualityBenchmarkReadiness({ dev, holdout }).ready, false);
});

test("same-label duplicates are warnings but cross-label duplicates are rejected", () => {
  const dev = makeBenchmarkPackage("dev", 1, { good: 48, bad: 48, borderline: 16 });
  const holdout = makeBenchmarkPackage("holdout_private", 201, { good: 12, bad: 12, borderline: 4 });
  dev.manifest.images[1].sha256 = dev.manifest.images[0].sha256;
  assert.equal(inspectQualityBenchmarkReadiness({ dev, holdout }).ready, true);
  dev.manifest.images[48].sha256 = dev.manifest.images[0].sha256;
  assert.equal(inspectQualityBenchmarkReadiness({ dev, holdout }).ready, false);
  assert.equal(inspectQualityBenchmarkReadiness({ dev, holdout }).dev.noCrossLabelDuplicates, false);
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

test("additive visual failures are not coerced into different runtime meanings", () => {
  assert.equal(toExactRuntimeFailureCategory("face_mismatch"), "face_mismatch");
  assert.equal(toExactRuntimeFailureCategory("text_artifact"), null);
  assert.equal(toExactRuntimeFailureCategory("orientation_error"), null);
});

test("benchmark preflight validates hashes, image profiles, intended files, and private labels", async () => {
  const source = await readFile(
    new URL("../scripts/check-manga-quality-benchmark.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /labels\.private\.json/);
  assert.match(source, /benchmark_image_hash_mismatch/);
  assert.match(source, /qualityBenchmarkIntendedSchema\.parse/);
  assert.match(source, /noCrossSplitDuplicates/);
  assert.match(source, /benchmark_png_contains_generation_metadata/);
  assert.match(source, /benchmark_image_inventory_mismatch/);
});

test("provider-neutral judge boundary imports no external provider SDK", async () => {
  const source = await readFile(
    new URL("../src/modules/manga-quality/application/manga-visual-judge.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /openai|anthropic|google|gemini/i);
});
