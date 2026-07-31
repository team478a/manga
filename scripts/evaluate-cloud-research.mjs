import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  classifyCloudResearchClaimPair,
} from "../src/lib/cloud-research-corroboration.ts";
import { extractCloudResearchClaimCandidates } from "../src/lib/cloud-research-claim-extraction.ts";
import {
  assessResearchEvaluation,
  evaluateClassifications,
  evaluateExtractions,
  researchRelations,
  researchTopics,
} from "../src/lib/cloud-research-evaluation.ts";

const extractionFixtureUrl = new URL(
  "../tests/fixtures/cloud-research-claim-extraction-golden.json",
  import.meta.url,
);
const classificationFixtureUrl = new URL(
  "../tests/fixtures/cloud-research-corroboration-golden.json",
  import.meta.url,
);
const thresholds = {
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
};

function ensure(condition, message) {
  if (!condition) throw new Error(`Invalid research fixture: ${message}`);
}

function validateCommonFixture(items, fixtureName) {
  ensure(Array.isArray(items), `${fixtureName} must be an array`);
  const ids = new Set();
  for (const item of items) {
    ensure(
      typeof item.id === "string" && item.id.trim().length > 0,
      `${fixtureName} has an empty id`,
    );
    ensure(!ids.has(item.id), `${fixtureName} has duplicate id ${item.id}`);
    ids.add(item.id);
  }
}

function validateExtractionFixture(items) {
  validateCommonFixture(items, "claim extraction");
  for (const item of items) {
    ensure(researchTopics.includes(item.topic), `${item.id} has invalid topic`);
    ensure(
      typeof item.text === "string" && item.text.trim(),
      `${item.id} has empty text`,
    );
    ensure(
      typeof item.expectedContains === "string" &&
        item.expectedContains.trim(),
      `${item.id} has empty expectedContains`,
    );
    ensure(
      Array.isArray(item.forbiddenContains) &&
        item.forbiddenContains.length > 0 &&
        item.forbiddenContains.every(
          (value) => typeof value === "string" && value.trim(),
        ),
      `${item.id} has invalid forbiddenContains`,
    );
  }
}

function validateClassificationFixture(items) {
  validateCommonFixture(items, "corroboration");
  for (const item of items) {
    ensure(
      researchRelations.includes(item.expected),
      `${item.id} has invalid expected relation`,
    );
    for (const field of ["primary", "comparison"])
      ensure(
        typeof item[field] === "string" && item[field].trim(),
        `${item.id} has empty ${field}`,
      );
    for (const field of ["primarySignals", "comparisonSignals"])
      ensure(
        Array.isArray(item[field]) &&
          item[field].every(
            (value) => typeof value === "string" && value.trim(),
          ),
        `${item.id} has invalid ${field}`,
      );
  }
}

function digest(text) {
  return createHash("sha256").update(text).digest("hex");
}

function snapshot(item) {
  const sha256 = digest(item.text);
  return {
    verification: {
      status: "verified",
      checkedAt: "2026-07-29T00:00:00.000Z",
      finalUrl: `https://evaluation.example/${item.id}`,
      contentType: "text/plain",
      byteSize: Buffer.byteLength(item.text),
      sha256,
    },
    text: item.text,
    textSha256: sha256,
    textTruncated: false,
  };
}

function claim(text, signals, id) {
  const sha256 = digest(text);
  return {
    id,
    text,
    topic: "demand",
    score: 20,
    signals,
    textStart: 0,
    textEnd: text.length,
    sourceSha256: sha256,
    textSha256: sha256,
  };
}

const [extractionFixtureText, classificationFixtureText] =
  await Promise.all([
    readFile(extractionFixtureUrl, "utf8"),
    readFile(classificationFixtureUrl, "utf8"),
  ]);
const extractionFixture = JSON.parse(extractionFixtureText);
const classificationFixture = JSON.parse(classificationFixtureText);
validateExtractionFixture(extractionFixture);
validateClassificationFixture(classificationFixture);

const extractionCases = extractionFixture.map((item) => {
  const result = extractCloudResearchClaimCandidates(
    snapshot(item),
    item.topic,
    "2026-07-29T00:01:00.000Z",
  );
  const topThree = result.candidates.slice(0, 3);
  return {
    id: item.id,
    topic: item.topic,
    expectedHit: topThree.some((candidate) =>
      candidate.text.includes(item.expectedContains),
    ),
    forbiddenLeak: result.candidates.some((candidate) =>
      item.forbiddenContains.some((forbidden) =>
        candidate.text.includes(forbidden),
      ),
    ),
  };
});
const classificationCases = classificationFixture.map((item) => ({
  id: item.id,
  expected: item.expected,
  actual: classifyCloudResearchClaimPair(
    claim(item.primary, item.primarySignals, `${item.id}:primary`),
    claim(
      item.comparison,
      item.comparisonSignals,
      `${item.id}:comparison`,
    ),
  ).relation,
}));
const extraction = evaluateExtractions(extractionCases);
const classification = evaluateClassifications(classificationCases);
const assessment = assessResearchEvaluation(
  extraction,
  classification,
  thresholds,
);
const report = {
  version: "research-eval-v1",
  passed: assessment.passed,
  fixtureDigest: digest(
    `${extractionFixtureText}\n${classificationFixtureText}`,
  ),
  thresholds,
  extraction,
  classification,
  failures: assessment.failures,
};

console.log(JSON.stringify(report, null, 2));
if (!assessment.passed) process.exitCode = 1;
