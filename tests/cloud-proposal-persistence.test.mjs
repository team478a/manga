import assert from "node:assert/strict";
import test from "node:test";
import {
  createCloudProposalRunWithPersistence,
  getCloudProposalRunWithPersistence,
  listCloudProposalRunsWithPersistence,
  selectCloudProposalWithPersistence,
} from "../src/lib/cloud-proposal-persistence.ts";
import { runCloudStoryProposal } from "../src/lib/cloud-proposal.ts";
import {
  parseCloudResearchForm,
  runCloudMarketAnalysis,
} from "../src/lib/cloud-research.ts";

const profileId = "10000000-0000-4000-8000-000000000001";
const reportId = "20000000-0000-4000-8000-000000000001";
const runId = "30000000-0000-4000-8000-000000000001";

function result() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    genre: "ファンタジー", audience: "Web漫画読者", platform: "電子書籍",
    contentClass: "general", theme: "再出発", referenceWorks: "参考作品",
    priceMin: "300", priceMax: "800", publicationFormat: "one_shot",
    pageCount: "48", sourceTitle0: "公式", sourceUrl0: "https://example.com",
    sourceRetrievedAt0: "2026-07-29T09:00", sourceFact0: "特集掲載。",
  })) form.set(key, value);
  const input = parseCloudResearchForm(form);
  const analysis = runCloudMarketAnalysis(input, "2026-07-29T00:00:00.000Z");
  return runCloudStoryProposal({
    input,
    findings: analysis.findings,
    sourceUrls: input.evidence.map((item) => item.url),
  }, "2026-07-29T01:00:00.000Z");
}

function run() {
  const proposal = result();
  return {
    id: runId, owner_profile_id: profileId, research_report_id: reportId,
    status: "completed", result: proposal, engine_version: proposal.engineVersion,
    completed_at: proposal.generatedAt, created_at: proposal.generatedAt,
  };
}

function persistence(overrides = {}) {
  const calls = { insertRun: [], listRuns: [], findRun: [], findSelection: [], insertSelection: [] };
  return {
    calls,
    adapter: {
      async insertRun(value) { calls.insertRun.push(value); return overrides.insertRun ?? { data: { id: runId }, error: null }; },
      async listRuns(owner) { calls.listRuns.push(owner); return overrides.listRuns ?? { data: [run()], error: null }; },
      async findRun(owner, id) { calls.findRun.push({ owner, id }); return overrides.findRun ?? { data: run(), error: null }; },
      async findSelection(owner, id) { calls.findSelection.push({ owner, id }); return overrides.findSelection ?? { data: null, error: null }; },
      async insertSelection(value) { calls.insertSelection.push(value); return overrides.insertSelection ?? { data: { id: "40000000-0000-4000-8000-000000000001" }, error: null }; },
    },
  };
}

test("企画Runは所有者・Report・完了状態をServerで設定する", async () => {
  const { adapter, calls } = persistence();
  assert.equal(await createCloudProposalRunWithPersistence({
    profileId, reportId, result: result(), persistence: adapter,
  }), runId);
  assert.equal(calls.insertRun[0].owner_profile_id, profileId);
  assert.equal(calls.insertRun[0].research_report_id, reportId);
  assert.equal(calls.insertRun[0].status, "completed");
});
test("企画一覧・詳細はProfileを限定し不正UUIDをDBへ渡さない", async () => {
  const { adapter, calls } = persistence();
  assert.equal((await listCloudProposalRunsWithPersistence({ profileId, persistence: adapter })).length, 1);
  assert.equal((await getCloudProposalRunWithPersistence({ profileId, runId, persistence: adapter })).id, runId);
  await assert.rejects(
    getCloudProposalRunWithPersistence({ profileId, runId: "bad", persistence: adapter }),
    (error) => error.code === "RESOURCE_NOT_FOUND",
  );
  assert.equal(calls.findRun.length, 1);
});

test("採用は保存済み候補snapshotだけを保存し二重採用を拒否する", async () => {
  const first = persistence();
  await selectCloudProposalWithPersistence({
    profileId, run: run(), candidateId: "candidate-balanced", persistence: first.adapter,
  });
  assert.equal(first.calls.insertSelection[0].candidate_snapshot.id, "candidate-balanced");
  await assert.rejects(
    selectCloudProposalWithPersistence({
      profileId, run: run(), candidateId: "unknown", persistence: first.adapter,
    }),
    (error) => error.code === "VALIDATION_ERROR",
  );
  await assert.rejects(
    selectCloudProposalWithPersistence({
      profileId, run: run(), candidateId: "candidate-balanced",
      persistence: persistence({ findSelection: { data: { id: "existing" }, error: null } }).adapter,
    }),
    /採用済み/,
  );
});

test("DB失敗の内部詳細を利用者へ公開しない", async () => {
  const privateError = new Error("private detail");
  await assert.rejects(
    createCloudProposalRunWithPersistence({
      profileId, reportId, result: result(),
      persistence: persistence({ insertRun: { data: null, error: privateError } }).adapter,
    }),
    (error) => error.code === "INTERNAL_ERROR" && !error.message.includes("private detail"),
  );
});
