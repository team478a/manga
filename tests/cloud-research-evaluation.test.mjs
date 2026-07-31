import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import {
  assessResearchEvaluation,
  evaluateClassifications,
  evaluateExtractions,
} from "../src/lib/cloud-research-evaluation.ts";

const execFileAsync = promisify(execFile);

test("分類評価はconfusion matrixとPrecision・Recall・F1を算出する", () => {
  const result = evaluateClassifications([
    { id: "c1", expected: "corroborates", actual: "corroborates" },
    { id: "c2", expected: "corroborates", actual: "related" },
    {
      id: "p1",
      expected: "potential_conflict",
      actual: "potential_conflict",
    },
    { id: "r1", expected: "related", actual: "related" },
    { id: "i1", expected: "insufficient", actual: "insufficient" },
  ]);

  assert.equal(result.total, 5);
  assert.equal(result.correct, 4);
  assert.equal(result.accuracy, 0.8);
  assert.equal(result.confusionMatrix.corroborates.related, 1);
  assert.equal(result.perRelation.corroborates.precision, 1);
  assert.equal(result.perRelation.corroborates.recall, 0.5);
  assert.equal(result.perRelation.corroborates.f1, 2 / 3);
  assert.equal(result.perRelation.related.precision, 0.5);
});

test("抽出評価を分野別に集計し品質不足を失敗理由として返す", () => {
  const extraction = evaluateExtractions([
    {
      id: "d1",
      topic: "demand",
      expectedHit: true,
      forbiddenLeak: false,
    },
    {
      id: "d2",
      topic: "demand",
      expectedHit: false,
      forbiddenLeak: true,
    },
  ]);
  const classification = evaluateClassifications([
    { id: "c1", expected: "corroborates", actual: "related" },
  ]);
  const result = assessResearchEvaluation(extraction, classification, {
    minimumExtractionCases: 21,
    minimumCasesPerTopic: 3,
    minimumTop3HitRate: 0.95,
    maximumForbiddenLeaks: 0,
    minimumClassificationCases: 28,
    minimumCasesPerRelation: 5,
    minimumAccuracy: 0.95,
    minimumMacroF1: 0.9,
    minimumConflictPrecision: 1,
    minimumConflictRecall: 0.9,
    minimumCorroboratesPrecision: 0.95,
    minimumCorroboratesRecall: 0.9,
  });

  assert.equal(extraction.top3HitRate, 0.5);
  assert.equal(extraction.forbiddenLeakRate, 0.5);
  assert.equal(result.passed, false);
  assert.ok(
    result.failures.some((failure) =>
      failure.startsWith("extraction.leakedCases"),
    ),
  );
  assert.ok(
    result.failures.some((failure) =>
      failure.startsWith("classification.accuracy"),
    ),
  );
});

test("Research Evaluation v1 commandは49件以上を決定的に評価する", async () => {
  const script = new URL(
    "../scripts/evaluate-cloud-research.mjs",
    import.meta.url,
  );
  const first = await execFileAsync(
    process.execPath,
    ["--experimental-strip-types", fileURLToPath(script)],
    { windowsHide: true },
  );
  const second = await execFileAsync(
    process.execPath,
    ["--experimental-strip-types", fileURLToPath(script)],
    { windowsHide: true },
  );
  const report = JSON.parse(first.stdout);

  assert.equal(first.stdout, second.stdout);
  assert.equal(report.version, "research-eval-v1");
  assert.equal(report.passed, true);
  assert.equal(report.extraction.total >= 21, true);
  assert.equal(report.extraction.top3HitRate >= 0.95, true);
  assert.equal(report.extraction.leakedCases, 0);
  assert.equal(report.classification.total >= 28, true);
  assert.equal(report.classification.accuracy >= 0.95, true);
  assert.equal(report.classification.macroF1 >= 0.9, true);
  assert.equal(report.failures.length, 0);
});

test("package commandとRequired Qualityに評価gateを固定する", async () => {
  const [packageJson, workflow] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(
      new URL("../.github/workflows/quality.yml", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(packageJson, /"research:eval"/);
  assert.match(workflow, /name: Cloud research evaluation/);
  assert.match(workflow, /npm run --silent research:eval/);
  assert.match(
    workflow,
    /artifacts\/test-results\/cloud-research-evaluation\.json/,
  );
  assert.ok(
    workflow.indexOf("name: Cloud research evaluation") <
      workflow.indexOf("name: Hub tests"),
  );
});
