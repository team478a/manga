import assert from "node:assert/strict";
import test from "node:test";
import { runCloudStoryProposal } from "../src/lib/cloud-proposal.ts";
import {
  parseCloudResearchForm,
  runCloudMarketAnalysis,
} from "../src/lib/cloud-research.ts";
import { runCloudScenario } from "../src/lib/cloud-scenario.ts";
import {
  confirmCloudScenarioWithPersistence,
  createCloudScenarioRunWithPersistence,
  getCloudScenarioRunWithPersistence,
  listCloudScenarioRunsWithPersistence,
} from "../src/lib/cloud-scenario-persistence.ts";

const profileId = "10000000-0000-4000-8000-000000000001";
const reportId = "20000000-0000-4000-8000-000000000001";
const proposalSelectionId = "40000000-0000-4000-8000-000000000001";
const runId = "50000000-0000-4000-8000-000000000001";

function scenario() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    genre: "ファンタジー", audience: "Web漫画読者", platform: "電子書籍",
    contentClass: "general", theme: "再出発", referenceWorks: "参考作品",
    priceMin: "300", priceMax: "800", publicationFormat: "one_shot",
    pageCount: "32", sourceTitle0: "公式", sourceUrl0: "https://example.com",
    sourceRetrievedAt0: "2026-07-29T09:00", sourceFact0: "特集掲載。",
  })) form.set(key, value);
  const input = parseCloudResearchForm(form);
  const analysis = runCloudMarketAnalysis(input, "2026-07-29T00:00:00.000Z");
  const proposal = runCloudStoryProposal({
    input,
    findings: analysis.findings,
    sourceUrls: input.evidence.map((item) => item.url),
  }, "2026-07-29T01:00:00.000Z");
  return runCloudScenario({
    proposalSelectionId,
    researchReportId: reportId,
    candidate: proposal.candidates[0],
    totalPages: input.pageCount,
    contentClass: "general",
  }, "2026-07-29T02:00:00.000Z");
}

function run() {
  const result = scenario();
  return {
    id: runId, owner_profile_id: profileId,
    proposal_selection_id: proposalSelectionId,
    research_report_id: reportId, parent_run_id: null,
    revision_number: 1, status: "completed", result,
    engine_version: result.engineVersion,
    completed_at: result.generatedAt, created_at: result.generatedAt,
  };
}

function persistence(overrides = {}) {
  const calls = { createRun: [], listRuns: [], findRun: [], findConfirmation: [], insertConfirmation: [] };
  return {
    calls,
    adapter: {
      async createRun(value) { calls.createRun.push(value); return overrides.createRun ?? { data: runId, error: null }; },
      async listRuns(owner, selection) { calls.listRuns.push({ owner, selection }); return overrides.listRuns ?? { data: [run()], error: null }; },
      async findRun(owner, id) { calls.findRun.push({ owner, id }); return overrides.findRun ?? { data: run(), error: null }; },
      async findConfirmation(owner, selection) { calls.findConfirmation.push({ owner, selection }); return overrides.findConfirmation ?? { data: null, error: null }; },
      async insertConfirmation(value) { calls.insertConfirmation.push(value); return overrides.insertConfirmation ?? { data: { id: "60000000-0000-4000-8000-000000000001" }, error: null }; },
    },
  };
}

test("シナリオ作成は採用ID・親Run・検証済み結果だけを永続化層へ渡す", async () => {
  const { adapter, calls } = persistence();
  assert.equal(await createCloudScenarioRunWithPersistence({
    proposalSelectionId, parentRunId: runId, result: scenario(), persistence: adapter,
  }), runId);
  assert.equal(calls.createRun[0].proposalSelectionId, proposalSelectionId);
  assert.equal(calls.createRun[0].parentRunId, runId);
  assert.equal(calls.createRun[0].result.engineVersion, "scenario-rules-v1");
});

test("一覧・詳細はProfileを限定し不正UUIDをDBへ渡さない", async () => {
  const { adapter, calls } = persistence();
  assert.equal((await listCloudScenarioRunsWithPersistence({
    profileId, proposalSelectionId, persistence: adapter,
  })).length, 1);
  assert.equal((await getCloudScenarioRunWithPersistence({
    profileId, runId, persistence: adapter,
  })).id, runId);
  await assert.rejects(
    getCloudScenarioRunWithPersistence({ profileId, runId: "bad", persistence: adapter }),
    (error) => error.code === "RESOURCE_NOT_FOUND",
  );
  assert.equal(calls.findRun.length, 1);
});

test("確定はRunのsnapshotを保存し二重確定を拒否する", async () => {
  const first = persistence();
  await confirmCloudScenarioWithPersistence({
    profileId, run: run(), persistence: first.adapter,
  });
  assert.deepEqual(first.calls.insertConfirmation[0].scenario_snapshot, run().result);
  await assert.rejects(
    confirmCloudScenarioWithPersistence({
      profileId,
      run: run(),
      persistence: persistence({
        findConfirmation: { data: { id: "existing" }, error: null },
      }).adapter,
    }),
    /確定済み/,
  );
});

test("DB失敗の内部詳細を利用者へ公開しない", async () => {
  const privateError = new Error("private detail");
  await assert.rejects(
    createCloudScenarioRunWithPersistence({
      proposalSelectionId,
      result: scenario(),
      persistence: persistence({
        createRun: { data: null, error: privateError },
      }).adapter,
    }),
    (error) =>
      error.code === "INTERNAL_ERROR" &&
      !error.message.includes(privateError.message),
  );
});
