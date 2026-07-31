import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getCloudProposalRunWithPersistence,
  selectCloudProposalWithPersistence,
} from "../src/lib/cloud-proposal-persistence.ts";

const reportId = "20000000-0000-4000-8000-000000000001";
const runId = "30000000-0000-4000-8000-000000000001";
const profileId = "10000000-0000-4000-8000-000000000001";
const candidate = {
  id: "candidate-best-fit",
  direction: "best_fit",
  title: "再出発の約束",
  logline: "主人公が期限付きの目的へ挑む。",
  readerPromise: "選択を応援したくなる体験。",
  protagonist: "一歩を踏み出せない会社員。",
  protagonistGoal: "新しい居場所を作る。",
  centralConflict: "成功と大切な関係の両立。",
  tone: "前向きで温かい。",
  differentiation: "仕事の技能を関係修復へ使う。",
  endingDirection: "自分の基準で未来を選ぶ。",
  productStrategy: "読切で反応を確認する。",
  whyItCanSell: "感情フックと購入理由が明確。",
  strengths: ["紹介文で魅力が伝わる。", "感情移入しやすい。"],
  tradeoffs: ["絵で類似テーマとの差を示す。"],
  salesFit: "strong",
  productionFit: "balanced",
  originality: "balanced",
};
const run = {
  id: runId,
  owner_profile_id: profileId,
  research_report_id: reportId,
  content_class: "general",
  status: "completed",
  result: {
    engineVersion: "openai-proposal-v1",
    generatedAt: "2026-07-30T00:00:00.000Z",
    model: "gpt-5.6-terra",
    classification: "ai_inference",
    containsGeneratedMarketNumbers: false,
    candidates: [
      candidate,
      { ...candidate, id: "candidate-differentiated", direction: "differentiated" },
      { ...candidate, id: "candidate-lean-test", direction: "lean_test" },
    ],
  },
  engine_version: "openai-proposal-v1",
  completed_at: "2026-07-30T00:00:00.000Z",
  created_at: "2026-07-30T00:00:00.000Z",
};

function persistence(overrides = {}) {
  return {
    insertRun: async () => ({ data: { id: runId }, error: null }),
    listRuns: async () => ({ data: [run], error: null }),
    findRun: async () => ({ data: run, error: null }),
    findSelection: async () => ({ data: null, error: null }),
    insertSelection: async () => ({
      data: { id: "40000000-0000-4000-8000-000000000001" },
      error: null,
    }),
    ...overrides,
  };
}

test("不正な企画Run UUIDはDB参照前に拒否する", async () => {
  let queried = false;
  await assert.rejects(
    getCloudProposalRunWithPersistence({
      profileId,
      runId: "not-a-uuid",
      persistence: persistence({
        findRun: async () => {
          queried = true;
          return { data: null, error: null };
        },
      }),
    }),
    /企画が見つかりません/,
  );
  assert.equal(queried, false);
});

test("所有者条件で取得できない企画Runはnot foundとして扱う", async () => {
  await assert.rejects(
    getCloudProposalRunWithPersistence({
      profileId,
      runId,
      persistence: persistence({
        findRun: async () => ({ data: null, error: null }),
      }),
    }),
    /企画が見つかりません/,
  );
});

test("選択した企画は候補snapshotとしてそのまま保存する", async () => {
  let saved;
  const selectionId = await selectCloudProposalWithPersistence({
    profileId,
    run,
    candidateId: candidate.id,
    persistence: persistence({
      insertSelection: async (value) => {
        saved = value;
        return {
          data: { id: "40000000-0000-4000-8000-000000000001" },
          error: null,
        };
      },
    }),
  });
  assert.equal(selectionId, "40000000-0000-4000-8000-000000000001");
  assert.deepEqual(saved.candidate_snapshot, candidate);
  assert.equal(saved.owner_profile_id, profileId);
  assert.equal(saved.research_report_id, reportId);
  assert.equal(saved.content_class, "general");
});

test("同じ企画の同時選択は既存結果を返して冪等に完了する", async () => {
  let lookupCount = 0;
  const existingId = "40000000-0000-4000-8000-000000000002";
  const selectionId = await selectCloudProposalWithPersistence({
    profileId,
    run,
    candidateId: candidate.id,
    persistence: persistence({
      findSelection: async () => {
        lookupCount += 1;
        return lookupCount === 1
          ? { data: null, error: null }
          : {
              data: {
                id: existingId,
                owner_profile_id: profileId,
                research_report_id: reportId,
                proposal_run_id: runId,
                candidate_id: candidate.id,
                candidate_snapshot: candidate,
                selected_at: "2026-07-30T00:00:01.000Z",
              },
              error: null,
            };
      },
      insertSelection: async () => ({
        data: null,
        error: { code: "23505", message: "private unique detail" },
      }),
    }),
  });
  assert.equal(selectionId, existingId);
  assert.equal(lookupCount, 2);
});

test("別企画との同時選択は内部DB情報を出さず選択済みとして扱う", async () => {
  let lookupCount = 0;
  await assert.rejects(
    selectCloudProposalWithPersistence({
      profileId,
      run,
      candidateId: candidate.id,
      persistence: persistence({
        findSelection: async () => {
          lookupCount += 1;
          return lookupCount === 1
            ? { data: null, error: null }
            : {
                data: {
                  id: "40000000-0000-4000-8000-000000000003",
                  owner_profile_id: profileId,
                  research_report_id: reportId,
                  proposal_run_id: runId,
                  candidate_id: "candidate-differentiated",
                  candidate_snapshot: {
                    ...candidate,
                    id: "candidate-differentiated",
                    direction: "differentiated",
                  },
                  selected_at: "2026-07-30T00:00:01.000Z",
                },
                error: null,
              };
        },
        insertSelection: async () => ({
          data: null,
          error: { code: "23505", message: "private unique detail" },
        }),
      }),
    }),
    (error) =>
      /企画を選択済み/.test(error.message) &&
      !error.message.includes("private unique detail"),
  );
});

test("proposal migrationは所有者RLSとReport・Run照合を強制する", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/202607300002_cloud_story_proposals.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /alter table public\.cloud_story_proposal_runs enable row level security/,
  );
  assert.match(
    migration,
    /alter table public\.cloud_story_proposal_selections enable row level security/,
  );
  assert.match(migration, /owner_profile_id = public\.current_profile_id\(\)/);
  assert.match(migration, /run\.research_report_id = research_report_id/);
  assert.match(migration, /candidate = candidate_snapshot/);
});
