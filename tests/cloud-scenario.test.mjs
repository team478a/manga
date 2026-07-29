import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runCloudStoryProposal } from "../src/lib/cloud-proposal.ts";
import {
  parseCloudResearchForm,
  runCloudMarketAnalysis,
} from "../src/lib/cloud-research.ts";
import {
  cloudScenarioFeatureEnabled,
  runCloudScenario,
} from "../src/lib/cloud-scenario.ts";

const selectionId = "40000000-0000-4000-8000-000000000001";
const reportId = "20000000-0000-4000-8000-000000000001";

function fixture() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    genre: "女性向けファンタジー",
    audience: "20代〜30代のWeb漫画読者",
    platform: "電子書籍ストア",
    contentClass: "general",
    theme: "再出発と仕事",
    referenceWorks: "参考作品A",
    priceMin: "300",
    priceMax: "800",
    publicationFormat: "one_shot",
    pageCount: "48",
    sourceTitle0: "公式ランキング",
    sourceUrl0: "https://example.com/ranking",
    sourceRetrievedAt0: "2026-07-29T09:00",
    sourceFact0: "公式特集に掲載されている。",
    sourceType0: "platform",
    sourceTopics0: "demand",
  })) form.set(key, value);
  const input = parseCloudResearchForm(form);
  const analysis = runCloudMarketAnalysis(input, "2026-07-29T00:00:00.000Z");
  const proposal = runCloudStoryProposal({
    input,
    findings: analysis.findings,
    sourceUrls: input.evidence.map((item) => item.url),
  }, "2026-07-29T01:00:00.000Z");
  return { input, candidate: proposal.candidates[0] };
}

function generate(overrides = {}) {
  const { input, candidate } = fixture();
  return runCloudScenario({
    proposalSelectionId: selectionId,
    researchReportId: reportId,
    candidate,
    totalPages: input.pageCount,
    contentClass: "general",
    focus: "initial",
    ...overrides,
  }, "2026-07-29T02:00:00.000Z");
}

test("シナリオFeature Flagは未設定時fail closed", () => {
  const previous = process.env.CLOUD_SCENARIO_MVP_ENABLED;
  delete process.env.CLOUD_SCENARIO_MVP_ENABLED;
  assert.equal(cloudScenarioFeatureEnabled(), false);
  process.env.CLOUD_SCENARIO_MVP_ENABLED = "TRUE";
  assert.equal(cloudScenarioFeatureEnabled(), true);
  if (previous === undefined) delete process.env.CLOUD_SCENARIO_MVP_ENABLED;
  else process.env.CLOUD_SCENARIO_MVP_ENABLED = previous;
});

test("採用企画から人物・三幕・連続Page配分を生成する", () => {
  const result = generate();
  assert.equal(result.engineVersion, "scenario-rules-v1");
  assert.equal(result.classification, "ai_inference");
  assert.equal(result.characters.length, 3);
  assert.equal(result.acts.length, 3);
  assert.equal(result.scenes.length, 8);
  assert.equal(result.scenes[0].pageStart, 1);
  assert.equal(result.scenes.at(-1).pageEnd, 48);
  for (let index = 1; index < result.scenes.length; index += 1)
    assert.equal(
      result.scenes[index].pageStart,
      result.scenes[index - 1].pageEnd + 1,
    );
  assert.deepEqual(result.proposalTrace, {
    proposalSelectionId: selectionId,
    candidateId: "candidate-balanced",
    researchReportId: reportId,
    sourceUrls: ["https://example.com/ranking"],
  });
});

test("1Page企画でも範囲外を作らず、改稿方針を結果へ固定する", () => {
  const result = generate({ totalPages: 1, focus: "character" });
  assert.equal(result.scenes.length, 1);
  assert.equal(result.scenes[0].pageStart, 1);
  assert.equal(result.scenes[0].pageEnd, 1);
  assert.equal(result.revisionFocus, "character");
  assert.match(result.scenes[0].dialogueGoal, /感情変化/);
});

test("成人向け・不正ページ数・出典なし企画を拒否する", () => {
  assert.throws(
    () => generate({ contentClass: "adult" }),
    /Desktop Adult/,
  );
  assert.throws(() => generate({ totalPages: 0 }), /ページ数/);
  const { candidate } = fixture();
  assert.throws(
    () => generate({ candidate: { ...candidate, sourceUrls: [] } }),
    /出典追跡/,
  );
});

test("シナリオUIは初稿・履歴・改稿・確定・レスポンシブ構造を持つ", async () => {
  const sources = await Promise.all([
    readFile(new URL("../src/app/dashboard/proposals/[runId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/scenarios/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/scenarios/[runId]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(sources[0], /createCloudScenarioAction/);
  assert.match(sources[1], /listCloudScenarioRuns/);
  assert.match(sources[2], /reviseCloudScenarioAction/);
  assert.match(sources[2], /confirmCloudScenarioAction/);
  assert.match(sources[2], /sm:grid-cols-2/);
  assert.match(sources[2], /md:grid-cols-3/);
  assert.match(sources[2], /AI推論|制作仮説|scenario-rules-v1|engine_version/);
});

test("シナリオmigrationは原子的版採番・所有者RLS・1企画1確定を持つ", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/202607290003_cloud_scenarios.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /coalesce\(max\(revision_number\), 0\) \+ 1/);
  assert.match(sql, /cloud_scenario_already_confirmed/);
  assert.match(sql, /cloud_scenario_initial_invalid/);
  assert.match(sql, /cloud_scenario_revision_invalid/);
  assert.match(sql, /proposalSelectionId/);
  assert.match(sql, /candidate_snapshot->'sourceUrls'/);
  assert.match(sql, /unique \(proposal_selection_id\)/);
  assert.match(sql, /run\.result = scenario_snapshot/);
  assert.doesNotMatch(sql, /grant insert on public\.cloud_scenario_runs to authenticated/i);
});
