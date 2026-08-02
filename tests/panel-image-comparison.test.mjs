import assert from "node:assert/strict";
import test from "node:test";
import { resolveComparisonSourceFrame } from "../src/app/creator/[projectId]/pages/[pageId]/services/panel-image-comparison.ts";

test("左右の画角拡張は元画像を拡張方向と反対側へ固定する", () => {
  assert.deepEqual(
    resolveComparisonSourceFrame({
      beforeWidth: 400,
      beforeHeight: 300,
      afterWidth: 500,
      afterHeight: 300,
      direction: "right",
    }),
    { left: 0, top: 0, width: 80, height: 100 },
  );
  assert.deepEqual(
    resolveComparisonSourceFrame({
      beforeWidth: 400,
      beforeHeight: 300,
      afterWidth: 500,
      afterHeight: 300,
      direction: "left",
    }),
    { left: 20, top: 0, width: 80, height: 100 },
  );
});

test("上下と全方向の画角拡張も元画像の位置を一致させる", () => {
  assert.deepEqual(
    resolveComparisonSourceFrame({
      beforeWidth: 400,
      beforeHeight: 300,
      afterWidth: 400,
      afterHeight: 375,
      direction: "top",
    }),
    { left: 0, top: 20, width: 100, height: 80 },
  );
  assert.deepEqual(
    resolveComparisonSourceFrame({
      beforeWidth: 400,
      beforeHeight: 300,
      afterWidth: 500,
      afterHeight: 375,
      direction: "all",
    }),
    { left: 10, top: 10, width: 80, height: 80 },
  );
});

test("通常修正は修正前と候補を同じ全面位置で比較する", () => {
  assert.deepEqual(
    resolveComparisonSourceFrame({
      beforeWidth: 400,
      beforeHeight: 300,
      afterWidth: 400,
      afterHeight: 300,
      direction: null,
    }),
    { left: 0, top: 0, width: 100, height: 100 },
  );
});
