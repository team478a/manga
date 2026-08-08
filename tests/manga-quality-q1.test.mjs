import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { panelSpecificationSchema } from "../src/modules/manga-quality/domain/panel-specification.ts";
import { classifyPanelQuality } from "../src/modules/manga-quality/domain/panel-quality-score.ts";
import {
  evaluatePanelCandidate,
  rankPanelCandidates,
} from "../src/modules/manga-quality/application/rule-based-panel-judge.ts";

const specification = panelSpecificationSchema.parse({
  version: 1,
  panelId: "00000000-0000-4000-8000-000000000001",
  characterNames: ["葵", "蓮"],
  expectedCharacterCount: 2,
  expression: "驚き",
  composition: "二人を中景で捉える",
  background: "駅のホーム",
  props: ["鞄"],
  action: "振り返る",
  shot: "medium",
  cameraAngle: "eye_level",
  generationTarget: "composite",
});

test("Panel Specification validates its source-of-truth fields", () => {
  assert.equal(specification.expectedCharacterCount, 2);
  assert.equal(panelSpecificationSchema.safeParse({ ...specification, panelId: "bad" }).success, false);
});

test("Judge produces all required scores and threshold bands", () => {
  const evaluation = evaluatePanelCandidate(specification, {
    assetAvailable: true,
    detectedCharacterCount: 2,
    characterMatch: 95,
    expressionMatch: 92,
    compositionMatch: 91,
    backgroundMatch: 90,
    propMatch: 94,
    anatomyQuality: 93,
    continuityMatch: 90,
  });
  assert.equal(evaluation.displayBand, "display");
  assert.equal(classifyPanelQuality(90), "display");
  assert.equal(classifyPanelQuality(75), "needs_repair");
  assert.equal(classifyPanelQuality(74.99), "low_priority");
  assert.deepEqual(Object.keys(evaluation.scores).sort(), [
    "anatomyScore", "backgroundScore", "characterMatchScore",
    "compositionScore", "continuityHintScore", "expressionScore",
    "overallScore", "propScore",
  ]);
});

test("Judge classifies observable failures without discarding the candidate", () => {
  const evaluation = evaluatePanelCandidate(specification, {
    assetAvailable: true,
    detectedCharacterCount: 1,
    expressionMatch: 40,
    compositionMatch: 40,
    backgroundMatch: 40,
    propMatch: 40,
    anatomyQuality: 40,
    continuityMatch: 40,
  });
  assert.ok(evaluation.failureCategories.includes("wrong_character_count"));
  assert.ok(evaluation.failureCategories.includes("wrong_expression"));
  assert.ok(evaluation.failureCategories.includes("body_distortion"));
  assert.equal(typeof evaluation.scores.overallScore, "number");
});

test("candidate ranking lowers low-quality priority and keeps every candidate", () => {
  const candidates = [
    { id: "low", created_at: "2026-08-08T00:00:00Z" },
    { id: "high", created_at: "2026-08-07T00:00:00Z" },
    { id: "unknown", created_at: "2026-08-09T00:00:00Z" },
  ];
  const ranked = rankPanelCandidates(candidates, new Map([["low", 60], ["high", 95]]));
  assert.deepEqual(ranked.map((candidate) => candidate.id), ["high", "low", "unknown"]);
  assert.equal(ranked.length, candidates.length);
});

test("Q1 persistence is additive and evaluation cannot fail a completed generation", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/202608080002_cloud_manga_quality_judge.sql", import.meta.url),
    "utf8",
  );
  const worker = await readFile(
    new URL("../src/modules/cloud-ai/application/process-generation.ts", import.meta.url),
    "utf8",
  );
  assert.match(migration, /cloud_manga_panel_specifications/);
  assert.match(migration, /cloud_manga_quality_evaluations/);
  assert.match(migration, /on conflict\(generation_job_id\)do nothing/i);
  assert.match(worker, /Evaluation is best-effort/);
  assert.doesNotMatch(worker, /providerId.*quality|modelId.*quality/);
});
