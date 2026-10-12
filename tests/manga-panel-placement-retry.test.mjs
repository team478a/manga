import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { retrySavedPanelPlacement } from "../src/modules/manga/application/retry-panel-placement.ts";
import { AutomaticPanelAdoptionRevisionConflictError } from "../src/modules/manga/application/auto-adopt-completed-panel.ts";

const jobId = "10000000-0000-4000-8000-000000000001";
const pageId = "20000000-0000-4000-8000-000000000001";
const panelId = "30000000-0000-4000-8000-000000000001";
const assetId = "40000000-0000-4000-8000-000000000001";
const profileId = "owner";

function fixture(candidateOverrides = {}, contextOverrides = {}) {
  let candidate = {
    creatorProfileId: profileId, ownerProfileId: profileId, pageId,
    kind: "image", status: "completed", outputAssetId: assetId,
    placementStatus: "placement_failed", retryable: true, rejected: false,
    ...candidateOverrides,
  };
  let context = {
    jobId, pageId, panelId, assetId, sourcePageRevision: 2, currentPageRevision: 2,
    automaticRevisionChain: true, productionStatus: "review_required",
    jobType: "background", generationOperation: "text_to_image", sourceAssetId: null,
    existingStatus: "placement_failed",
    canvas: {
      schemaVersion: 1, pageId, width: 1200, height: 1800, backgroundColor: "#ffffff",
      panels: [{ id: panelId, pageId, imageAssetId: null, locked: false, visible: true }],
      panelLayers: [], balloons: [], textObjects: [],
    },
    ...contextOverrides,
  };
  const calls = { created: 0, loaded: 0, saved: [], recorded: [] };
  const repository = {
    async load() { calls.loaded++; return structuredClone(context); },
    async save(input) {
      // Emulate the existing RPC's atomic persistence + adoption record.
      if (context.canvas.panelLayers.some(layer => layer.sourceJobId === jobId))
        return { revision: context.currentPageRevision };
      calls.saved.push(structuredClone(input));
      context = { ...context, canvas: structuredClone(input.canvas), currentPageRevision: 3 };
      candidate = { ...candidate, placementStatus: "auto_placed", retryable: false };
      return { revision: 3 };
    },
    async record(input) { calls.recorded.push(input); },
  };
  const input = {
    jobId, pageId, profileId,
    async loadCandidate() { return structuredClone(candidate); },
    createRepository() { calls.created++; return repository; },
  };
  return { input, repository, calls, setCandidate(value) { candidate = value; } };
}

test("placement retry reuses the completed Job/Asset, then repeated request is a no-op", async () => {
  const f = fixture();
  assert.deepEqual(await retrySavedPanelPlacement(f.input), { status: "auto_placed", revision: 3 });
  assert.equal(f.calls.saved.length, 1);
  const saved = f.calls.saved[0];
  assert.equal(saved.jobId, jobId);
  assert.equal(saved.canvas.panels[0].imageAssetId, assetId);
  assert.equal(saved.canvas.panelLayers.length, 1);
  assert.equal(saved.canvas.panelLayers[0].sourceJobId, jobId);
  assert.equal(saved.canvas.panelLayers[0].assetId, assetId);
  assert.deepEqual(await retrySavedPanelPlacement(f.input), { status: "auto_placed", noOp: true });
  assert.equal(f.calls.saved.length, 1);
  assert.equal(f.calls.created, 1);
});

test("foreign owner, foreign creator, wrong page, and invisible Job never create admin repository", async (t) => {
  for (const overrides of [{ ownerProfileId: "other" }, { creatorProfileId: "other" }, { pageId: "other" }])
    await t.test(JSON.stringify(overrides), async () => {
      const f = fixture(overrides);
      await assert.rejects(retrySavedPanelPlacement(f.input), { code: "RESOURCE_NOT_FOUND" });
      assert.equal(f.calls.created, 0);
    });
  const f = fixture();
  f.setCandidate(null);
  await assert.rejects(retrySavedPanelPlacement(f.input), { code: "RESOURCE_NOT_FOUND" });
  assert.equal(f.calls.created, 0);
});

test("pending/failed/text/missing-output/nonretryable/unknown states cannot trigger placement", async (t) => {
  for (const overrides of [{ status: "queued" }, { status: "failed" }, { kind: "text" },
    { outputAssetId: null }, { retryable: false }, { placementStatus: null }])
    await t.test(JSON.stringify(overrides), async () => {
      const f = fixture(overrides);
      await assert.rejects(retrySavedPanelPlacement(f.input), { code: "VALIDATION_ERROR" });
      assert.equal(f.calls.created, 0);
      assert.equal(f.calls.saved.length, 0);
    });
});

test("rejected and review-required candidates do not overwrite Canvas", async () => {
  for (const overrides of [{ rejected: true }, { placementStatus: "rejected" }, { placementStatus: "review_required" }]) {
    const f = fixture(overrides);
    const result = await retrySavedPanelPlacement(f.input);
    assert.equal(result.status, overrides.placementStatus === "review_required" ? "review_required" : "rejected");
    assert.equal(f.calls.created, 0);
    assert.equal(f.calls.saved.length, 0);
  }
});

test("missing/deleted output and page/asset mismatch fail closed on repository reload", async () => {
  for (const contextOverride of [null, { jobId: "other" }, { pageId: "other" }, { assetId: "other" }]) {
    const f = fixture({}, contextOverride ?? {});
    if (contextOverride === null) f.repository.load = async () => null;
    assert.equal((await retrySavedPanelPlacement(f.input)).status, "not_eligible");
    assert.equal(f.calls.saved.length, 0);
  }
});

test("saved edits, finalized pages and manual images are preserved", async () => {
  const cases = [
    { currentPageRevision: 3, automaticRevisionChain: false },
    { productionStatus: "finalized" },
    { canvas: { panels: [{ id: panelId, imageAssetId: "manual" }], panelLayers: [] } },
  ];
  for (const overrides of cases) {
    const f = fixture({}, overrides);
    assert.equal((await retrySavedPanelPlacement(f.input)).status, "review_required");
    assert.equal(f.calls.saved.length, 0);
    assert.equal(f.calls.recorded[0].retryable, false);
  }
});

test("interrupted adoption record recognizes the already saved layer without duplicating it", async () => {
  const f = fixture({}, { canvas: {
    panels: [{ id: panelId, imageAssetId: assetId }],
    panelLayers: [{ panelId, sourceJobId: jobId, assetId }],
  } });
  assert.deepEqual(await retrySavedPanelPlacement(f.input), { status: "auto_placed", noOp: true });
  assert.equal(f.calls.saved.length, 0);
  assert.equal(f.calls.recorded[0].reasonCode, "already_applied");
});

test("concurrent requests converge to one saved image via existing idempotency", async () => {
  const f = fixture();
  const results = await Promise.all([retrySavedPanelPlacement(f.input), retrySavedPanelPlacement(f.input)]);
  // Repository contract test, not an external database concurrency test.
  assert.ok(results.every(result => result.status === "auto_placed"));
  assert.equal(f.calls.saved.length, 1);
});

test("rejection during conflict recovery stops the next placement attempt", async () => {
  const f = fixture();
  const loadCandidate = f.input.loadCandidate;
  let rejected = false;
  f.input.loadCandidate = async () => ({ ...await loadCandidate(), rejected });
  f.repository.save = async () => {
    f.calls.saved.push("attempt");
    rejected = true;
    throw new AutomaticPanelAdoptionRevisionConflictError();
  };
  assert.equal((await retrySavedPanelPlacement(f.input)).status, "rejected");
  assert.equal(f.calls.saved.length, 1);
  assert.equal(f.calls.recorded.length, 0);
});

test("revision conflict rechecks current permissions/rejection before a second write", async () => {
  const f = fixture();
  f.repository.save = async () => {
    f.calls.saved.push("attempt");
    f.setCandidate({ creatorProfileId: "other" });
    throw new AutomaticPanelAdoptionRevisionConflictError();
  };
  assert.equal((await retrySavedPanelPlacement(f.input)).status, "not_eligible");
  assert.equal(f.calls.saved.length, 1);
});

test("persistence failure remains placement_failed; no generation retry is available in the dependency contract", async () => {
  const f = fixture();
  f.repository.save = async () => { throw new Error("storage unavailable"); };
  assert.equal((await retrySavedPanelPlacement(f.input)).status, "placement_failed");
  assert.equal(f.calls.recorded[0].retryable, true);
  assert.equal(f.calls.recorded[0].reasonCode, "persistence_failed");
});

test("retry endpoint is distinct from generation retry and UI guards unsaved changes", () => {
  const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const application = read("src/modules/manga/application/retry-panel-placement.ts");
  const service = read("src/modules/manga/infrastructure/panel-placement-retry-service.ts");
  assert.doesNotMatch(application + service, /enqueue|consumeCloudGeneralMonitorAiRequest|retryFailedInteractive|selectCloudAiProvider/);
  assert.match(service, /eq\("created_by_profile_id", profile.id\)/);
  assert.match(service, /eq\("owner_profile_id", profile.id\)/);
  assert.match(service, /eq\("event_type", "rejected"\)/);
  const route = read("src/modules/manga/presentation/panel-placement-retry-route.ts");
  assert.match(route, /\.strict\(\)/);
  assert.match(route, /enforceCloudAiRateLimit/);
  const editor = read("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx");
  const handler = editor.slice(editor.indexOf("async function retrySavedImagePlacement"), editor.indexOf("function movePanelLayer"));
  assert.match(handler, /saveState !== "saved" \|\| hasUnsavedChanges\(\)/);
  assert.match(handler, /pageLockState !== "acquired"/);
  assert.match(handler, /retryPlacement\(job.id, page.id\)/);
  assert.doesNotMatch(handler, /retryGeneration\(|createGenerationJob\(|refreshQuota\(/);
  const sql = read("supabase/migrations/202608140002_cloud_generation_panel_adoption_revision_chain.sql");
  assert.match(sql, /where id=p_job_id for update/);
  assert.match(sql, /deleted_at is null for update/);
  assert.ok(sql.indexOf("'already_applied'") < sql.indexOf("v_page.revision<>p_expected_revision"));
  assert.match(sql, /source_generation_job_id=v_job.id and asset.deleted_at is null/);
});
