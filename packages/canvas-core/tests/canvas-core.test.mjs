import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  applyPageTemplate,
  canvasBatchInputSchema,
  computeImagePlacement,
  constrainRectToPage,
  layoutVerticalText,
  normalizeLayerOrder,
  normalizeRotation,
  pageSizeSchema,
  pageTemplates,
  pageToViewport,
  panelInputSchema,
  segmentGraphemes,
  snapRectToGuides,
  viewportToPage,
} from "../dist/index.js";
test("page and viewport coordinates round-trip", () => {
  const viewport = { scale: 0.5, offsetX: 20, offsetY: 30 },
    page = { x: 248, y: 350.8 },
    displayed = pageToViewport(page, viewport);
  assert.deepEqual(displayed, { x: 144, y: 205.4 });
  assert.deepEqual(viewportToPage(displayed, viewport), page);
});
test("rectangles remain inside the page", () =>
  assert.deepEqual(
    constrainRectToPage(
      { x: -50, y: 900, width: -500, height: 300 },
      { width: 1000, height: 1000 },
    ),
    { x: 0, y: 700, width: 500, height: 300 },
  ));
test("minimum dimensions and rotations are normalized", () => {
  const value = constrainRectToPage(
    { x: 50, y: 50, width: 1, height: 2 },
    { width: 500, height: 500 },
  );
  assert.equal(value.width, 16);
  assert.equal(value.height, 16);
  assert.equal(normalizeRotation(-450), 270);
  assert.equal(normalizeRotation(725), 5);
});
test("cover and contain image placement remain centered", () => {
  assert.deepEqual(
    computeImagePlacement(
      { width: 200, height: 100 },
      { x: 10, y: 20, width: 100, height: 100 },
      { fit: "contain" },
    ),
    { x: 10, y: 45, width: 100, height: 50 },
  );
  assert.deepEqual(
    computeImagePlacement(
      { width: 200, height: 100 },
      { x: 10, y: 20, width: 100, height: 100 },
      { fit: "cover", scale: 2, offsetX: 5 },
    ),
    { x: -135, y: -30, width: 400, height: 200 },
  );
});
test("objects snap to page and neighboring guides", () => {
  assert.deepEqual(
    snapRectToGuides(
      { x: 47, y: 96, width: 100, height: 100 },
      { width: 1000, height: 1000 },
      [{ x: 150, y: 200, width: 200, height: 100 }],
      5,
    ),
    {
      rect: { x: 50, y: 100, width: 100, height: 100 },
      guides: { vertical: [150], horizontal: [200] },
    },
  );
});
test("z-index is unique and continuous", () => {
  const values = normalizeLayerOrder([
    { id: "front", zIndex: 99 },
    { id: "back", zIndex: -1 },
    { id: "middle", zIndex: 8 },
  ]);
  assert.deepEqual(
    values.map((value) => [value.id, value.zIndex]),
    [
      ["back", 0],
      ["middle", 1],
      ["front", 2],
    ],
  );
});
test("six ratio-based templates create expected counts", () => {
  assert.equal(pageTemplates.length, 6);
  assert.deepEqual(
    pageTemplates.map(
      (template) =>
        applyPageTemplate(template.id, { width: 2480, height: 3508 }).length,
    ),
    [1, 2, 2, 3, 4, 6],
  );
  const panels = applyPageTemplate("four_equal", { width: 1000, height: 2000 });
  assert.ok(
    panels.every(
      (panel) =>
        panel.width > 0 && panel.height > 0 && panel.x >= 0 && panel.y >= 0,
    ),
  );
});
test("vertical segmentation preserves surrogate pairs", () =>
  assert.deepEqual(segmentGraphemes("漫画😀𠮷"), ["漫", "画", "😀", "𠮷"]));
test("vertical columns advance right to left", () => {
  const result = layoutVerticalText(
    "一二三四五六",
    { x: 0, y: 0, width: 100, height: 60 },
    { fontSize: 20, lineHeight: 1 },
  );
  assert.equal(result.columns, 2);
  assert.ok(result.glyphs[3].x < result.glyphs[0].x);
  assert.deepEqual(
    result.glyphs.map((glyph) => glyph.value),
    ["一", "二", "三", "四", "五", "六"],
  );
});
test("Zod rejects unsafe pages and panels", () => {
  assert.equal(
    pageSizeSchema.safeParse({ width: 20_001, height: 100 }).success,
    false,
  );
  assert.equal(
    pageSizeSchema.safeParse({ width: 20_000, height: 20_000 }).success,
    false,
  );
  assert.equal(
    panelInputSchema.safeParse({
      id: randomUUID(),
      pageId: randomUUID(),
      name: "コマ1",
      x: 0,
      y: 0,
      width: -1,
      height: 100,
      rotation: 0,
      zIndex: 0,
      visible: true,
      locked: false,
      borderColor: "#000",
      borderWidth: 4,
      fillColor: "#fff",
      imageAssetId: null,
      imageFit: "cover",
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageScale: 1,
      imageRotation: 0,
      imageOpacity: 1,
    }).success,
    false,
  );
});
test("canvas batch requires every object to belong to its page", () => {
  const pageId = randomUUID();
  assert.equal(
    canvasBatchInputSchema.safeParse({
      pageId,
      panels: [
        {
          id: randomUUID(),
          pageId: randomUUID(),
          name: "別ページのコマ",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          zIndex: 0,
          visible: true,
          locked: false,
          borderColor: "#000",
          borderWidth: 4,
          fillColor: "#fff",
          imageAssetId: null,
          imageFit: "cover",
          imageOffsetX: 0,
          imageOffsetY: 0,
          imageScale: 1,
          imageRotation: 0,
          imageOpacity: 1,
        },
      ],
    }).success,
    false,
  );
});
