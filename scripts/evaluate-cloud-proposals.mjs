import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  assessCloudProposalEvaluation,
  evaluateCloudProposalCases,
} from "../src/lib/cloud-proposal-evaluation.ts";
import { evaluateCloudProposalQuality } from "../src/lib/cloud-proposal-quality.ts";
import { runCloudStoryProposal } from "../src/lib/cloud-proposal.ts";
import {
  parseCloudResearchForm,
  runCloudMarketAnalysis,
} from "../src/lib/cloud-research.ts";

const fixtureUrl = new URL(
  "../tests/fixtures/cloud-proposal-evaluation-golden.json",
  import.meta.url,
);
const thresholds = {
  minimumCases: 24,
  minimumGenres: 6,
  minimumCasesPerGenre: 4,
  minimumCasesPerFormat: 8,
  minimumPassRate: 1,
  maximumGenerationFailures: 0,
  maximumIssues: 0,
};

function ensure(condition, message) {
  if (!condition) throw new Error(`Invalid proposal fixture: ${message}`);
}

function validateFixture(items) {
  ensure(Array.isArray(items), "root must be an array");
  const ids = new Set();
  for (const item of items) {
    ensure(
      typeof item.id === "string" && item.id.trim(),
      "case has an empty id",
    );
    ensure(!ids.has(item.id), `duplicate id ${item.id}`);
    ids.add(item.id);
    for (const field of [
      "genre",
      "audience",
      "platform",
      "theme",
      "referenceWorks",
    ])
      ensure(
        typeof item[field] === "string" && item[field].trim(),
        `${item.id} has empty ${field}`,
      );
    ensure(
      ["one_shot", "series"].includes(item.publicationFormat),
      `${item.id} has invalid publicationFormat`,
    );
    ensure(
      Number.isInteger(item.pageCount) &&
        item.pageCount >= 8 &&
        item.pageCount <= 200,
      `${item.id} has invalid pageCount`,
    );
    ensure(
      Number.isInteger(item.priceMin) &&
        Number.isInteger(item.priceMax) &&
        item.priceMin >= 0 &&
        item.priceMax >= item.priceMin,
      `${item.id} has invalid price`,
    );
  }
}

function digest(text) {
  return createHash("sha256").update(text).digest("hex");
}

function research(item) {
  const form = new FormData();
  const sourceFact = `${item.genre}の評価fixtureに登録された制作条件です。`;
  for (const [key, value] of Object.entries({
    genre: item.genre,
    audience: item.audience,
    platform: item.platform,
    contentClass: "general",
    theme: item.theme,
    referenceWorks: item.referenceWorks,
    priceMin: String(item.priceMin),
    priceMax: String(item.priceMax),
    publicationFormat: item.publicationFormat,
    pageCount: String(item.pageCount),
    sourceTitle0: `評価fixture ${item.id}`,
    sourceUrl0: `https://evaluation.example/proposal/${item.id}`,
    sourceRetrievedAt0: "2026-07-29T09:00",
    sourceFact0: sourceFact,
    sourceType0: "platform",
  }))
    form.set(key, value);
  for (const topic of ["demand", "competition", "audience", "theme", "price", "channel", "risk"])
    form.append("sourceTopics0", topic);
  const input = parseCloudResearchForm(form);
  const analysis = runCloudMarketAnalysis(
    input,
    "2026-07-29T00:00:00.000Z",
  );
  return {
    input,
    findings: analysis.findings,
    sourceUrls: input.evidence.map((evidence) => evidence.url),
  };
}

const fixtureText = await readFile(fixtureUrl, "utf8");
const fixture = JSON.parse(fixtureText);
validateFixture(fixture);

const cases = fixture.map((item) => {
  try {
    const source = research(item);
    const result = runCloudStoryProposal(
      source,
      "2026-07-29T01:00:00.000Z",
    );
    const quality = evaluateCloudProposalQuality(
      result,
      source.input,
      source.findings,
    );
    return {
      id: item.id,
      genre: item.genre,
      publicationFormat: item.publicationFormat,
      generated: true,
      issues: quality.issues,
    };
  } catch {
    return {
      id: item.id,
      genre: item.genre,
      publicationFormat: item.publicationFormat,
      generated: false,
      issues: [],
    };
  }
});

const evaluation = evaluateCloudProposalCases(cases);
const assessment = assessCloudProposalEvaluation(evaluation, thresholds);
const report = {
  version: "proposal-eval-v1",
  passed: assessment.passed,
  fixtureDigest: digest(fixtureText),
  thresholds,
  evaluation,
  failedCaseIds: cases
    .filter((item) => !item.generated || item.issues.length > 0)
    .map((item) => item.id),
  failures: assessment.failures,
};

console.log(JSON.stringify(report, null, 2));
if (!assessment.passed) process.exitCode = 1;
