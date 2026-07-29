import assert from "node:assert/strict";
import test from "node:test";
import {
  createCloudMangaGenerationWithPersistence,
  getCloudMangaGenerationByConfirmationWithPersistence,
  getCloudMangaGenerationWithPersistence,
  listCloudMangaGenerationsWithPersistence,
} from "../src/lib/cloud-manga-persistence.ts";

const profileId = "10000000-0000-4000-8000-000000000001";
const confirmationId = "60000000-0000-4000-8000-000000000001";
const generationId = "70000000-0000-4000-8000-000000000001";
const projectId = "80000000-0000-4000-8000-000000000001";
const pageId = "90000000-0000-4000-8000-000000000001";

const result = {
  engineVersion: "manga-layout-rules-v1",
  generatedAt: "2026-07-29T03:00:00.000Z",
  classification: "ai_inference",
  title: "作品",
  totalPages: 1,
  projectSettings: {
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1600,
    height: 2400,
    dpi: 300,
  },
  scenarioTrace: {
    confirmationId,
    scenarioRunId: "50000000-0000-4000-8000-000000000001",
    proposalSelectionId: "40000000-0000-4000-8000-000000000001",
  },
  pages: [
    {
      pageNumber: 1,
      sceneId: "scene-01",
      sceneHeading: "決着",
      sceneSummary: "主人公が答えを出す。",
      pageRole: "opening",
      layoutId: "single",
      panelCount: 1,
    },
  ],
};

function row() {
  return {
    id: generationId,
    owner_profile_id: profileId,
    scenario_confirmation_id: confirmationId,
    scenario_run_id: result.scenarioTrace.scenarioRunId,
    project_id: projectId,
    status: "completed",
    result,
    engine_version: result.engineVersion,
    completed_at: result.generatedAt,
    created_at: result.generatedAt,
  };
}

function persistence(overrides = {}) {
  const calls = {
    createGeneration: [],
    listGenerations: [],
    findGeneration: [],
    findByConfirmation: [],
  };
  return {
    calls,
    adapter: {
      async createGeneration(value) {
        calls.createGeneration.push(value);
        return (
          overrides.createGeneration ?? {
            data: {
              generation_id: generationId,
              project_id: projectId,
              first_page_id: pageId,
            },
            error: null,
          }
        );
      },
      async listGenerations(owner) {
        calls.listGenerations.push(owner);
        return overrides.listGenerations ?? { data: [row()], error: null };
      },
      async findGeneration(owner, id) {
        calls.findGeneration.push({ owner, id });
        return overrides.findGeneration ?? { data: row(), error: null };
      },
      async findByConfirmation(owner, id) {
        calls.findByConfirmation.push({ owner, id });
        return overrides.findByConfirmation ?? { data: row(), error: null };
      },
    },
  };
}

test("生成は確認IDと検証済みplanだけをRPC境界へ渡す", async () => {
  const { adapter, calls } = persistence();
  const saved = await createCloudMangaGenerationWithPersistence({
    confirmationId,
    result,
    persistence: adapter,
  });
  assert.equal(saved.project_id, projectId);
  assert.equal(calls.createGeneration[0].confirmationId, confirmationId);
  assert.equal(
    calls.createGeneration[0].result.engineVersion,
    "manga-layout-rules-v1",
  );
});

test("履歴・詳細・Confirmation検索はProfileを限定する", async () => {
  const { adapter, calls } = persistence();
  assert.equal(
    (
      await listCloudMangaGenerationsWithPersistence({
        profileId,
        persistence: adapter,
      })
    ).length,
    1,
  );
  assert.equal(
    (
      await getCloudMangaGenerationWithPersistence({
        profileId,
        generationId,
        persistence: adapter,
      })
    ).id,
    generationId,
  );
  assert.equal(
    (
      await getCloudMangaGenerationByConfirmationWithPersistence({
        profileId,
        confirmationId,
        persistence: adapter,
      })
    ).project_id,
    projectId,
  );
  assert.deepEqual(calls.findGeneration[0], {
    owner: profileId,
    id: generationId,
  });
});

test("不正UUIDをDBへ渡さず、DB内部詳細を利用者へ公開しない", async () => {
  const first = persistence();
  await assert.rejects(
    getCloudMangaGenerationWithPersistence({
      profileId,
      generationId: "bad",
      persistence: first.adapter,
    }),
    (error) => error.code === "RESOURCE_NOT_FOUND",
  );
  assert.equal(first.calls.findGeneration.length, 0);
  const privateError = new Error("private database detail");
  await assert.rejects(
    createCloudMangaGenerationWithPersistence({
      confirmationId,
      result,
      persistence: persistence({
        createGeneration: { data: null, error: privateError },
      }).adapter,
    }),
    (error) =>
      error.code === "INTERNAL_ERROR" &&
      !error.message.includes(privateError.message),
  );
});
