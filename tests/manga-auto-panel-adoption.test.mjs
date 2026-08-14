import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { cloudGenerationInputSchema } from "@mangai/ai-core";
import {
  adoptCompletedPanelCandidate,
  AutomaticPanelAdoptionRevisionConflictError,
} from "../src/modules/manga/application/auto-adopt-completed-panel.ts";

const read = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function canvas(overrides = {}) {
  return {
    schemaVersion: 1,
    pageId: "20000000-0000-4000-8000-000000000001",
    width: 1200,
    height: 1800,
    backgroundColor: "#ffffff",
    panels: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        pageId: "20000000-0000-4000-8000-000000000001",
        name: "コマ1",
        x: 0,
        y: 0,
        width: 600,
        height: 600,
        rotation: 0,
        zIndex: 0,
        visible: true,
        locked: false,
        borderColor: "#111111",
        borderWidth: 8,
        fillColor: "#ffffff",
        shape: "rectangle",
        slant: 0,
        imageAssetId: null,
        imageFit: "cover",
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageRotation: 0,
        imageOpacity: 1,
        createdAt: "2026-08-14T00:00:00.000Z",
        updatedAt: "2026-08-14T00:00:00.000Z",
      },
    ],
    panelLayers: [],
    balloons: [],
    textObjects: [],
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    jobId: "10000000-0000-4000-8000-000000000001",
    pageId: "20000000-0000-4000-8000-000000000001",
    panelId: "30000000-0000-4000-8000-000000000001",
    assetId: "40000000-0000-4000-8000-000000000001",
    assetFileName: "generated.png",
    sourcePageRevision: 2,
    currentPageRevision: 2,
    automaticRevisionChain: true,
    productionStatus: "review_required",
    jobType: "background",
    generationOperation: "text_to_image",
    sourceAssetId: null,
    canvas: canvas(),
    existingStatus: null,
    ...overrides,
  };
}

function repository(contexts, saveImpl = async () => ({ revision: 3 })) {
  const calls = { saved: [], recorded: [], loaded: 0 };
  return {
    calls,
    adapter: {
      async load() {
        const value = contexts[Math.min(calls.loaded, contexts.length - 1)];
        calls.loaded += 1;
        return structuredClone(value);
      },
      async save(input) {
        calls.saved.push(structuredClone(input));
        return saveImpl(input, calls);
      },
      async record(input) {
        calls.recorded.push(input);
      },
    },
  };
}

test("1候補の完了画像を対象コマへ採用して永続化する", async () => {
  const repo = repository([context()]);
  const result = await adoptCompletedPanelCandidate({
    jobId: context().jobId,
    repository: repo.adapter,
    createId: () => "50000000-0000-4000-8000-000000000001",
    now: () => "2026-08-14T01:00:00.000Z",
  });
  assert.equal(result.status, "auto_placed");
  assert.equal(repo.calls.saved.length, 1);
  const saved = repo.calls.saved[0].canvas;
  assert.equal(saved.panels[0].imageAssetId, context().assetId);
  assert.equal(saved.panelLayers.length, 1);
  assert.equal(saved.panelLayers[0].panelId, context().panelId);
  assert.equal(saved.panelLayers[0].sourceJobId, context().jobId);
});

test("同じJobの再処理はCanvasを変えない成功no-opになる", async () => {
  const repo = repository([context({ existingStatus: "auto_placed" })]);
  const result = await adoptCompletedPanelCandidate({
    jobId: context().jobId,
    repository: repo.adapter,
  });
  assert.deepEqual(result, { status: "auto_placed", noOp: true });
  assert.equal(repo.calls.saved.length, 0);
});

test("手動画像、生成後revision変更、finalizedを上書きしない", async (t) => {
  const cases = [
    {
      name: "manual image",
      value: context({
        canvas: canvas({
          panels: [{ ...canvas().panels[0], imageAssetId: "manual-asset" }],
        }),
      }),
      reason: "manual_image_present",
    },
    {
      name: "revision changed",
      value: context({
        currentPageRevision: 3,
        automaticRevisionChain: false,
      }),
      reason: "source_revision_changed",
    },
    {
      name: "finalized",
      value: context({ productionStatus: "finalized" }),
      reason: "page_finalized",
    },
    {
      name: "locked target layer",
      value: context({
        canvas: canvas({
          panelLayers: [
            {
              panelId: context().panelId,
              type: "background",
              locked: true,
              assetId: null,
              sourceJobId: null,
            },
          ],
        }),
      }),
      reason: "target_layer_locked",
    },
  ];
  for (const item of cases)
    await t.test(item.name, async () => {
      const repo = repository([item.value]);
      const result = await adoptCompletedPanelCandidate({
        jobId: context().jobId,
        repository: repo.adapter,
      });
      assert.equal(result.status, "review_required");
      assert.equal(repo.calls.saved.length, 0);
      assert.equal(repo.calls.recorded[0].reasonCode, item.reason);
    });
});

test("同じ開始revisionから自動配置だけが連続した後続コマを保存する", async () => {
  const repo = repository([
    context({ currentPageRevision: 4, automaticRevisionChain: true }),
  ], async () => ({ revision: 5 }));
  const result = await adoptCompletedPanelCandidate({
    jobId: context().jobId,
    repository: repo.adapter,
    createId: () => "50000000-0000-4000-8000-000000000002",
    now: () => "2026-08-14T01:05:00.000Z",
  });
  assert.deepEqual(result, { status: "auto_placed", revision: 5 });
  assert.equal(repo.calls.saved[0].expectedRevision, 4);
  assert.equal(repo.calls.saved[0].canvas.panelLayers.length, 1);
});

test("revision差分に自動配置以外が混在する場合は後続コマを停止する", async () => {
  const repo = repository([
    context({ currentPageRevision: 4, automaticRevisionChain: false }),
  ]);
  const result = await adoptCompletedPanelCandidate({
    jobId: context().jobId,
    repository: repo.adapter,
  });
  assert.deepEqual(result, {
    status: "review_required",
    reasonCode: "source_revision_changed",
  });
  assert.equal(repo.calls.saved.length, 0);
});

test("revision競合は1回だけ再読込し、既存採用を重複させない", async () => {
  const first = context();
  const secondCanvas = canvas();
  secondCanvas.panelLayers.push({
    id: "50000000-0000-4000-8000-000000000001",
    panelId: first.panelId,
    name: "AI背景レイヤー",
    type: "background",
    orderIndex: 0,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    assetId: first.assetId,
    sourceJobId: first.jobId,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    createdAt: "2026-08-14T01:00:00.000Z",
    updatedAt: "2026-08-14T01:00:00.000Z",
  });
  const repo = repository(
    [first, context({ canvas: secondCanvas })],
    async () => {
      throw new AutomaticPanelAdoptionRevisionConflictError();
    },
  );
  const result = await adoptCompletedPanelCandidate({
    jobId: first.jobId,
    repository: repo.adapter,
  });
  assert.deepEqual(result, { status: "auto_placed", noOp: true });
  assert.equal(repo.calls.saved.length, 1);
  assert.equal(repo.calls.recorded.at(-1).status, "auto_placed");
});

test("private generation metadata only enables one-candidate image adoption", () => {
  const base = {
    kind: "image",
    jobType: "background",
    prompt: "safe panel",
    negativePrompt: "",
    width: 1024,
    height: 1024,
    targetPanelId: context().panelId,
    sourcePageRevision: 2,
    candidateCount: 1,
    autoAdopt: true,
  };
  assert.equal(cloudGenerationInputSchema.safeParse(base).success, true);
  assert.equal(
    cloudGenerationInputSchema.safeParse({ ...base, candidateCount: 2 }).success,
    false,
  );
});

test("migration keeps adoption owner-only and persistence service-role-only", () => {
  const sql = read(
    "supabase/migrations/202608140001_cloud_generation_panel_adoptions.sql",
  );
  assert.match(sql, /enable row level security/);
  assert.match(sql, /owner_profile_id=public\.current_profile_id\(\)/);
  assert.match(sql, /auth\.role\(\)<>'service_role'/g);
  assert.match(sql, /v_page\.production_status='finalized'/);
  assert.match(sql, /v_page\.revision<>v_source_revision/);
  assert.match(sql, /sourceJobId/);
  assert.match(sql, /panel_auto_adopted/);
  assert.match(sql, /job\.status='completed'/);
  assert.match(sql, /adoption\.attempt_count<2/);
  assert.doesNotMatch(
    sql,
    /grant execute on function public\.save_cloud_generation_panel_adoption[^;]+authenticated/,
  );
});

test("follow-up migration only accepts a gapless auto-placement revision chain", () => {
  const sql = read(
    "supabase/migrations/202608140002_cloud_generation_panel_adoption_revision_chain.sql",
  );
  assert.match(sql, /generate_series\(p_source_revision\+1,p_current_revision\)/);
  assert.match(sql, /adoption\.status='auto_placed'/);
  assert.match(sql, /adoption\.source_page_revision=p_source_revision/);
  assert.match(sql, /save_cloud_generation_panel_adoption_v2/);
  assert.match(sql, /auth\.role\(\)<>'service_role'/g);
  assert.doesNotMatch(
    sql,
    /grant execute on function public\.save_cloud_generation_panel_adoption_v2[^;]+authenticated/,
  );
  const repository = read(
    "src/modules/manga/infrastructure/auto-panel-adoption-repository.ts",
  );
  assert.match(repository, /is_cloud_generation_panel_adoption_revision_chain/);
  assert.match(repository, /save_cloud_generation_panel_adoption_v2/);
});

test("worker completes the Job before best-effort placement and reconciles interruptions", () => {
  const worker = read("src/modules/cloud-ai/application/process-generation.ts");
  const completion = worker.indexOf("await completeCloudGenerationJob");
  const adoption = worker.indexOf("await adoptCompletedPanelCandidate", completion);
  assert.ok(completion >= 0 && adoption > completion);
  assert.match(worker, /processPendingCloudPanelAdoption/);
  const route = read("src/app/api/internal/cloud-ai/worker/route.ts");
  assert.match(route, /processPendingCloudPanelAdoption\(\{ client \}\)/);
});
