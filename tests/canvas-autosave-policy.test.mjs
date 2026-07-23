import test from "node:test";
import assert from "node:assert/strict";
import {
  CANVAS_SAVE_RETRY_MAX_MS,
  canvasSaveRetryDelay,
  hasUnsavedCanvasChanges,
  shouldRetryCanvasSave,
} from "../src/lib/canvas-autosave-policy.ts";

test("Canvas保存retryは指数backoffし上限で止まる", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 10].map(canvasSaveRetryDelay),
    [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000],
  );
  assert.equal(canvasSaveRetryDelay(99), CANVAS_SAVE_RETRY_MAX_MS);
});

test("通信・一時障害だけを自動retryし競合と入力不正はretryしない", () => {
  assert.equal(shouldRetryCanvasSave(), true);
  assert.equal(shouldRetryCanvasSave(408), true);
  assert.equal(shouldRetryCanvasSave(429), true);
  assert.equal(shouldRetryCanvasSave(503), true);
  assert.equal(shouldRetryCanvasSave(409), false);
  assert.equal(shouldRetryCanvasSave(400), false);
  assert.equal(shouldRetryCanvasSave(403), false);
});

test("未保存・保存中・error・競合は離脱警告対象になる", () => {
  assert.equal(hasUnsavedCanvasChanges("saved"), false);
  for (const state of ["dirty", "saving", "error", "conflict"])
    assert.equal(hasUnsavedCanvasChanges(state), true);
});
