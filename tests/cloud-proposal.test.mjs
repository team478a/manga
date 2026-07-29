import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cloudProposalFeatureEnabled,
  runCloudStoryProposal,
} from "../src/lib/cloud-proposal.ts";
import { evaluateCloudProposalQuality } from "../src/lib/cloud-proposal-quality.ts";
import {
  parseCloudResearchForm,
  runCloudMarketAnalysis,
} from "../src/lib/cloud-research.ts";

function research(contentClass = "general") {
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
  const parsed = parseCloudResearchForm(form);
  const input =
    contentClass === "general" ? parsed : { ...parsed, contentClass: "adult" };
  const analysis = runCloudMarketAnalysis(
    { ...input, contentClass: "general" },
    "2026-07-29T00:00:00.000Z",
  );
  return {
    input,
    findings: analysis.findings,
    sourceUrls: input.evidence.map((item) => item.url),
  };
}

test("企画Feature Flagは未設定時fail closed", () => {
  const previous = process.env.CLOUD_PROPOSAL_MVP_ENABLED;
  delete process.env.CLOUD_PROPOSAL_MVP_ENABLED;
  assert.equal(cloudProposalFeatureEnabled(), false);
  process.env.CLOUD_PROPOSAL_MVP_ENABLED = "TRUE";
  assert.equal(cloudProposalFeatureEnabled(), true);
  if (previous === undefined) delete process.env.CLOUD_PROPOSAL_MVP_ENABLED;
  else process.env.CLOUD_PROPOSAL_MVP_ENABLED = previous;
});

test("市場分析から方向性の異なる3企画を生成する", () => {
  const result = runCloudStoryProposal(
    research(),
    "2026-07-29T01:00:00.000Z",
  );
  assert.equal(result.engineVersion, "proposal-rules-v1");
  assert.equal(result.classification, "ai_inference");
  assert.equal(result.containsGeneratedMarketNumbers, false);
  assert.deepEqual(
    result.candidates.map((item) => item.direction),
    ["balanced", "differentiated", "focused"],
  );
  for (const candidate of result.candidates) {
    assert.deepEqual(candidate.sourceUrls, ["https://example.com/ranking"]);
    assert.ok(candidate.risks.length >= 1);
    assert.ok(candidate.researchFindingKeys.includes("next_proposal"));
  }
});

test("企画品質ゲートは3案の差異・根拠追跡・数値制約を確認する", () => {
  const source = research();
  const result = runCloudStoryProposal(
    source,
    "2026-07-29T01:00:00.000Z",
  );
  assert.deepEqual(
    evaluateCloudProposalQuality(result, source.input, source.findings),
    {
      passed: true,
      issues: [],
    },
  );

  const duplicated = structuredClone(result);
  duplicated.candidates[1].title = duplicated.candidates[0].title;
  assert.deepEqual(
    evaluateCloudProposalQuality(duplicated, source.input, source.findings)
      .issues,
    ["candidates_not_distinct"],
  );

  const unsupported = structuredClone(result);
  unsupported.candidates[0].salesPositioning += " 売上12345件を見込みます。";
  assert.ok(
    evaluateCloudProposalQuality(
      unsupported,
      source.input,
      source.findings,
    ).issues.includes("unsupported_number"),
  );
});

test("企画品質ゲートは参考作品名の流用と内部根拠欠落を拒否する", () => {
  const source = research();
  const result = runCloudStoryProposal(
    source,
    "2026-07-29T01:00:00.000Z",
  );
  const copied = structuredClone(result);
  copied.candidates[0].title = "参考作品A 新章";
  copied.candidates[1].sourceUrls = [];
  const quality = evaluateCloudProposalQuality(
    copied,
    source.input,
    source.findings,
  );
  assert.equal(quality.passed, false);
  assert.ok(quality.issues.includes("reference_work_reused"));
  assert.ok(quality.issues.includes("research_trace_missing"));
});

test("企画生成は出典なしと成人向けを拒否する", () => {
  assert.throws(
    () => runCloudStoryProposal({ ...research(), sourceUrls: [] }),
    /出典付き/,
  );
  assert.throws(() => runCloudStoryProposal(research("adult")), /Desktop Adult/);
});

test("企画UIは生成・履歴・比較・採用を備える", async () => {
  const sources = await Promise.all([
    readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/proposals/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/proposals/[runId]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(sources[0], /createCloudProposalAction/);
  assert.match(sources[1], /listCloudProposalRuns/);
  assert.match(sources[2], /selectCloudProposalAction/);
  assert.match(sources[2], /xl:grid-cols-3/);
  assert.match(sources[2], /md:grid-cols-2/);
  assert.match(sources[2], /この企画で進める/);
  assert.doesNotMatch(sources.join("\n"), /run\.engine_version/);
  assert.doesNotMatch(sources.join("\n"), /researchFindingKeys/);
  assert.doesNotMatch(sources.join("\n"), /sourceUrls/);
  assert.doesNotMatch(sources.join("\n"), /AI推論/);
});

test("企画migrationはimmutable Run・所有者RLS・1Report 1採用を持つ", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/202607290002_cloud_story_proposals.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /owner_profile_id = public\.current_profile_id\(\)/);
  assert.match(sql, /unique \(research_report_id\)/);
  assert.match(sql, /candidate = candidate_snapshot/);
  assert.doesNotMatch(sql, /grant .*update.*authenticated/i);
});
