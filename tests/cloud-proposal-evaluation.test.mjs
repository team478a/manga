import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import {
  assessCloudProposalEvaluation,
  evaluateCloudProposalCases,
} from "../src/lib/cloud-proposal-evaluation.ts";

const execFileAsync = promisify(execFile);

test("企画評価は品質issue・ジャンル・形式を集計する", () => {
  const evaluation = evaluateCloudProposalCases([
    {
      id: "ok",
      genre: "現代恋愛",
      publicationFormat: "one_shot",
      generated: true,
      issues: [],
    },
    {
      id: "ng",
      genre: "近未来SF",
      publicationFormat: "series",
      generated: true,
      issues: ["reference_work_reused", "unsupported_number"],
    },
    {
      id: "error",
      genre: "近未来SF",
      publicationFormat: "series",
      generated: false,
      issues: [],
    },
  ]);

  assert.equal(evaluation.total, 3);
  assert.equal(evaluation.passed, 1);
  assert.equal(evaluation.passRate, 1 / 3);
  assert.equal(evaluation.generationFailures, 1);
  assert.equal(evaluation.totalIssues, 2);
  assert.equal(evaluation.issueCounts.reference_work_reused, 1);
  assert.equal(evaluation.issueCounts.unsupported_number, 1);
  assert.deepEqual(evaluation.perGenre, { 現代恋愛: 1, 近未来SF: 2 });
  assert.deepEqual(evaluation.perFormat, { one_shot: 1, series: 2 });
});

test("企画評価は閾値不足を失敗理由として返す", () => {
  const evaluation = evaluateCloudProposalCases([
    {
      id: "ng",
      genre: "現代恋愛",
      publicationFormat: "one_shot",
      generated: false,
      issues: [],
    },
  ]);
  const result = assessCloudProposalEvaluation(evaluation, {
    minimumCases: 24,
    minimumGenres: 6,
    minimumCasesPerGenre: 4,
    minimumCasesPerFormat: 8,
    minimumPassRate: 1,
    maximumGenerationFailures: 0,
    maximumIssues: 0,
  });

  assert.equal(result.passed, false);
  assert.ok(result.failures.some((failure) => failure.includes("total")));
  assert.ok(result.failures.some((failure) => failure.includes("genres")));
  assert.ok(
    result.failures.some((failure) => failure.includes("generationFailures")),
  );
});

test("Proposal Evaluation v1 commandは24件を決定的に評価する", async () => {
  const script = new URL(
    "../scripts/evaluate-cloud-proposals.mjs",
    import.meta.url,
  );
  const args = ["--experimental-strip-types", fileURLToPath(script)];
  const first = await execFileAsync(process.execPath, args, {
    windowsHide: true,
  });
  const second = await execFileAsync(process.execPath, args, {
    windowsHide: true,
  });
  const report = JSON.parse(first.stdout);

  assert.equal(first.stdout, second.stdout);
  assert.equal(report.version, "proposal-eval-v1");
  assert.equal(report.passed, true);
  assert.equal(report.evaluation.total, 24);
  assert.equal(report.evaluation.passRate, 1);
  assert.equal(report.evaluation.generationFailures, 0);
  assert.equal(report.evaluation.totalIssues, 0);
  assert.equal(Object.keys(report.evaluation.perGenre).length, 6);
  assert.equal(report.evaluation.perFormat.one_shot >= 8, true);
  assert.equal(report.evaluation.perFormat.series >= 8, true);
  assert.deepEqual(report.failedCaseIds, []);
  assert.deepEqual(report.failures, []);
});

test("package commandとRequired Qualityに企画評価gateを固定する", async () => {
  const [packageJson, workflow] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(
      new URL("../.github/workflows/quality.yml", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(packageJson, /"proposal:eval"/);
  assert.match(workflow, /name: Cloud proposal evaluation/);
  assert.match(workflow, /npm run --silent proposal:eval/);
  assert.match(
    workflow,
    /artifacts\/test-results\/cloud-proposal-evaluation\.json/,
  );
  assert.ok(
    workflow.indexOf("name: Cloud proposal evaluation") <
      workflow.indexOf("name: Hub tests"),
  );
});
