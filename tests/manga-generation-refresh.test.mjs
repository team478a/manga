import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  needsGenerationRefresh, generationRefreshKey, newAutoPlacementIds,
  autoPlacementRefreshDecision, candidateDisplayCanBeRecorded,
} from "../src/modules/manga/domain/generation-refresh-policy.ts";
import { createLatestGenerationReader } from "../src/modules/manga/application/latest-generation-reader.ts";

const job = (overrides = {}) => ({
  id: "job-1", kind: "image", page_id: "page-1", status: "completed",
  output_asset_id: "asset-1", panel_adoption_eligible: true,
  panel_adoption_status: null, panel_adoption_retryable: false,
  quality_review_status: "pending", ...overrides,
});
const decision = overrides => autoPlacementRefreshDecision({
  newPlacement: true, visibleInCanvas: false, saveState: "saved", unsaved: false,
  editLockAcquired: true, previouslyBlocked: false, ...overrides,
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("poll generation and pending/retryable placement, but not terminal/manual/rejected states", () => {
  for (const overrides of [{ status: "queued", output_asset_id: null }, { status: "running" }, {},
    { panel_adoption_status: "placement_failed", panel_adoption_retryable: true }])
    assert.equal(needsGenerationRefresh([job(overrides)], "page-1"), true);
  for (const overrides of [{ status: "failed" }, { status: "canceled" }, { kind: "text" },
    { output_asset_id: null }, { panel_adoption_eligible: false }, { panel_adoption_status: "auto_placed" },
    { panel_adoption_status: "review_required" }, { panel_adoption_status: "rejected" },
    { quality_review_status: "rejected" }, { panel_adoption_status: "placement_failed" }, { page_id: "other" }])
    assert.equal(needsGenerationRefresh([job(overrides)], "page-1"), false);
});

test("poll key is stable across responses/progress/order, but changes on placement transitions", () => {
  const jobs = [job(), job({ id: "job-2", status: "running", progress: 20 })];
  assert.equal(generationRefreshKey(jobs, "page-1"), generationRefreshKey([
    job({ id: "job-2", status: "running", progress: 80 }), job(),
  ], "page-1"));
  assert.notEqual(generationRefreshKey(jobs, "page-1"), generationRefreshKey([
    job({ panel_adoption_status: "auto_placed" }), jobs[1],
  ], "page-1"));
});

test("only newly observed valid auto-placement is a reload candidate", () => {
  const placed = job({ panel_adoption_status: "auto_placed" });
  assert.deepEqual(newAutoPlacementIds([job()], [placed], "page-1"), [placed.id]);
  assert.deepEqual(newAutoPlacementIds([placed], [placed], "page-1"), []);
  // A fresh snapshot/history after reload is already auto_placed: no reload loop.
  assert.deepEqual(newAutoPlacementIds([placed], [structuredClone(placed)], "page-1"), []);
  for (const overrides of [{ page_id: "other" }, { kind: "text" }, { status: "failed" },
    { output_asset_id: null }, { quality_review_status: "rejected" }])
    assert.deepEqual(newAutoPlacementIds([job()], [job({ ...placed, ...overrides })], "page-1"), []);
});

test("clean acquired page may reload once; visible or old placement does not reload", () => {
  assert.equal(decision({}), "reload");
  assert.equal(decision({ visibleInCanvas: true }), "none");
  assert.equal(decision({ newPlacement: false }), "none");
});

test("dirty/saving/conflict/error and ref-dirty protect edits; blocking remains sticky after save", () => {
  for (const saveState of ["dirty", "saving", "conflict", "error"])
    assert.equal(decision({ saveState }), "manual");
  assert.equal(decision({ unsaved: true }), "manual");
  assert.equal(decision({ editLockAcquired: false }), "manual");
  assert.equal(decision({ previouslyBlocked: true, saveState: "saved" }), "manual");
});

test("completed Job metadata alone cannot record displayed candidate", () => {
  const valid = { loaded: true, naturalWidth: 640, naturalHeight: 480, intersecting: true, documentVisible: true };
  assert.equal(candidateDisplayCanBeRecorded(valid), true);
  for (const overrides of [{ loaded: false }, { naturalWidth: 0 }, { naturalHeight: 0 },
    { intersecting: false }, { documentVisible: false }])
    assert.equal(candidateDisplayCanBeRecorded({ ...valid, ...overrides }), false);
});

test("superseded history response cannot overwrite the latest request, even when abort is ignored", async () => {
  const first = deferred(), second = deferred();
  const signals = [];
  const reader = createLatestGenerationReader(signal => {
    signals.push(signal);
    return signals.length === 1 ? first.promise : second.promise;
  });
  const oldRead = reader.read();
  const latestRead = reader.read();
  assert.equal(signals[0].aborted, true);
  second.resolve(["latest"]);
  assert.deepEqual(await latestRead, ["latest"]);
  first.resolve(["stale"]);
  assert.equal(await oldRead, null);
});

test("stale errors are ignored while current errors remain actionable", async () => {
  const first = deferred(); let count = 0;
  const reader = createLatestGenerationReader(async () => {
    if (++count === 1) return first.promise;
    throw new Error("offline");
  });
  const oldRead = reader.read();
  await assert.rejects(reader.read(), /offline/);
  first.reject(new Error("stale error"));
  assert.equal(await oldRead, null);
});

test("unmount cancels reads and React strict effect remount does not revive old responses", async () => {
  const old = deferred(); let count = 0;
  const reader = createLatestGenerationReader(async () => ++count === 1 ? old.promise : ["new mount"]);
  const pending = reader.read();
  reader.dispose();
  assert.equal(await reader.read(), null);
  reader.activate();
  assert.deepEqual(await reader.read(), ["new mount"]);
  old.resolve(["old page"]);
  assert.equal(await pending, null);
});

test("UI integration uses bounded sequential polling, sticky reload guard and decoded viewport candidate", () => {
  const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const editor = read("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx");
  const polling = editor.slice(editor.indexOf("const generationPollingKey"), editor.indexOf("for (const id of newAutoPlacementIds"));
  assert.match(polling, /await refreshGenerationJobs\(\)/);
  assert.match(polling, /setTimeout/);
  assert.doesNotMatch(polling, /setInterval/);
  assert.match(polling, /placementPolls < 20/);
  assert.match(polling, /generationPollingKey, generationInProgress/);
  assert.match(editor, /previouslyBlocked: blockedAutoPlacementIds.current.size > 0/);
  assert.match(editor, /generationReader.dispose\(\)/);
  assert.match(editor, /attempts >= 3/);
  assert.match(editor, /GeneratedCandidateImage/);
  assert.match(read("src/app/creator/[projectId]/pages/[pageId]/page.tsx"), /key=\{page.id\}/);
  const image = read("src/app/creator/[projectId]/pages/[pageId]/GeneratedCandidateImage.tsx");
  assert.match(image, /IntersectionObserver/);
  assert.match(image, /naturalWidth/);
  assert.match(image, /document.visibilityState === "visible"/);
  assert.match(image, /onError/);
  assert.match(image, /currentSrc === new URL/);
  assert.match(image, /observer.disconnect\(\)/);
  assert.match(image, /active = false/);
});
