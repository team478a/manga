import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  applyPageTemplate,
  canvasBatchInputSchema,
  computeImagePlacement,
  constrainRectToPage,
  imageTransformFromNode,
  layoutHorizontalText,
  layoutVerticalText,
  normalizeLayerOrder,
  normalizeRotation,
  parseRubyText,
  pageSizeSchema,
  pageTemplates,
  pageToViewport,
  panelInputSchema,
  panelShapePoints,
  rectFromPoints,
  reorderLayer,
  remapChildRect,
  segmentGraphemes,
  snapPointToGrid,
  snapRectToGrid,
  snapRectToGuides,
  tokenizeVerticalText,
  viewportToPage,
  verticalGlyph,
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
test("panel shape points create safe parallelograms", () => {
  assert.deepEqual(
    panelShapePoints({
      width: 100,
      height: 80,
      shape: "rectangle",
      slant: 0.12,
    }),
    [0, 0, 100, 0, 100, 80, 0, 80],
  );
  assert.deepEqual(
    panelShapePoints({
      width: 100,
      height: 80,
      shape: "slant_up",
      slant: 0.2,
    }),
    [20, 0, 100, 0, 80, 80, 0, 80],
  );
  assert.deepEqual(
    panelShapePoints({
      width: 100,
      height: 80,
      shape: "slant_down",
      slant: 0.2,
    }),
    [0, 0, 80, 0, 100, 80, 20, 80],
  );
  assert.equal(
    Math.max(
      ...panelShapePoints({
        width: 100,
        height: 80,
        shape: "slant_up",
        slant: 5,
      }),
    ),
    100,
  );
});
test("child rectangles follow parent movement and resizing", () => {
  assert.deepEqual(
    remapChildRect(
      { x: 120, y: 140, width: 100, height: 80 },
      { x: 100, y: 100, width: 200, height: 200 },
      { x: 300, y: 200, width: 400, height: 100 },
    ),
    { x: 340, y: 220, width: 200, height: 40 },
  );
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
test("image node transforms convert back to persistent scale and offsets", () => {
  assert.deepEqual(
    imageTransformFromNode(
      { width: 200, height: 100 },
      { x: 0, y: 0, width: 100, height: 100 },
      { fit: "cover", scale: 1 },
      { x: -70, y: -10, scaleX: 1.5, scaleY: 1.5 },
    ),
    { scale: 1.5, offsetX: 30, offsetY: 15 },
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
test("points, rectangles, and drawn bounds snap to the grid", () => {
  assert.deepEqual(snapPointToGrid({ x: 149, y: 251 }, 100), {
    x: 100,
    y: 300,
  });
  assert.deepEqual(
    snapRectToGrid({ x: 149, y: 251, width: 320, height: 480 }, 100),
    { x: 100, y: 300, width: 320, height: 480 },
  );
  assert.deepEqual(
    rectFromPoints(
      { x: 930, y: 810 },
      { x: -20, y: 190 },
      { width: 1000, height: 1000 },
      100,
    ),
    { x: 0, y: 200, width: 900, height: 600 },
  );
  assert.throws(() => snapPointToGrid({ x: 10, y: 20 }, 0));
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
test("layers reorder by visual position and composite object key", () => {
  const values = [
    { id: "same", type: "panel", name: "front", zIndex: 2 },
    { id: "middle", type: "text", name: "middle", zIndex: 1 },
    { id: "same", type: "balloon", name: "back", zIndex: 0 },
  ];
  const reordered = reorderLayer(
    values,
    { id: "same", type: "balloon" },
    { id: "same", type: "panel" },
    "before",
  );
  assert.deepEqual(
    [...reordered]
      .sort((a, b) => b.zIndex - a.zIndex)
      .map((value) => value.name),
    ["back", "front", "middle"],
  );
  assert.deepEqual(
    reordered.map((value) => value.zIndex),
    [0, 1, 2],
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
test("Japanese punctuation uses vertical presentation forms", () => {
  assert.equal(verticalGlyph("。"), "︒");
  assert.equal(verticalGlyph("「"), "﹁");
  assert.equal(verticalGlyph("ー"), "｜");
  assert.equal(verticalGlyph("漫"), "漫");
});
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
test("two ASCII digits form one tate-chu-yoko cell", () => {
  assert.deepEqual(tokenizeVerticalText("第12話345"), [
    { value: "第", tateChuYoko: false, sourceStart: 0, sourceLength: 1 },
    { value: "12", tateChuYoko: true, sourceStart: 1, sourceLength: 2 },
    { value: "話", tateChuYoko: false, sourceStart: 3, sourceLength: 1 },
    { value: "34", tateChuYoko: true, sourceStart: 4, sourceLength: 2 },
    { value: "5", tateChuYoko: false, sourceStart: 6, sourceLength: 1 },
  ]);
  const result = layoutVerticalText(
    "12月",
    { x: 0, y: 0, width: 40, height: 40 },
    { fontSize: 20, lineHeight: 1 },
  );
  assert.equal(result.glyphs.length, 2);
  assert.equal(result.glyphs[0].value, "12");
  assert.equal(result.glyphs[0].tateChuYoko, true);
});
test("vertical layout avoids prohibited punctuation at column boundaries", () => {
  const closing = layoutVerticalText(
    "あいう。え",
    { x: 0, y: 0, width: 100, height: 60 },
    { fontSize: 20, lineHeight: 1 },
  );
  assert.deepEqual(
    closing.glyphs.map(({ column, row }) => [column, row]),
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  );
  const opening = layoutVerticalText(
    "あい「う",
    { x: 0, y: 0, width: 100, height: 60 },
    { fontSize: 20, lineHeight: 1 },
  );
  assert.deepEqual(
    opening.glyphs.map(({ column, row }) => [column, row]),
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  );
});
test("explicit ruby notation is parsed and laid out beside vertical text", () => {
  assert.deepEqual(parseRubyText("これは｜漫画《まんが》です"), {
    plainText: "これは漫画です",
    annotations: [{ base: "漫画", reading: "まんが", start: 3, length: 2 }],
  });
  assert.deepEqual(parseRubyText("不完全な｜記法《"), {
    plainText: "不完全な｜記法《",
    annotations: [],
  });
  const result = layoutVerticalText(
    "｜漫画《まんが》12",
    { x: 0, y: 0, width: 100, height: 120 },
    { fontSize: 20, lineHeight: 1 },
  );
  assert.deepEqual(
    result.glyphs.map((glyph) => glyph.value),
    ["漫", "画", "12"],
  );
  assert.deepEqual(
    result.rubyGlyphs.map((glyph) => glyph.value),
    ["ま", "ん", "が"],
  );
  assert.ok(result.rubyGlyphs.every((glyph) => glyph.x > result.glyphs[0].x));
});
test("horizontal ruby stays with its base and uses shared line layout", () => {
  const result = layoutHorizontalText(
    "第12話 ｜漫画《まんが》です",
    { x: 10, y: 20, width: 110, height: 100 },
    {
      fontSize: 20,
      lineHeight: 1.2,
      textAlign: "start",
      verticalAlign: "top",
    },
  );
  assert.equal(result.plainText, "第12話 漫画です");
  assert.deepEqual(
    result.lines.map((line) => line.value),
    ["第12話 ", "漫画です"],
  );
  assert.equal(result.rubyRuns.length, 1);
  assert.equal(result.rubyRuns[0].value, "まんが");
  assert.equal(result.rubyRuns[0].line, 1);
  assert.ok(result.rubyRuns[0].y < result.lines[1].y);
});
test("horizontal layout preserves explicit blank lines", () => {
  const result = layoutHorizontalText(
    "一\n\n二",
    { x: 0, y: 0, width: 100, height: 100 },
    { fontSize: 20 },
  );
  assert.deepEqual(
    result.lines.map((line) => line.value),
    ["一", "", "二"],
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
      shape: "rectangle",
      slant: 0.12,
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
          shape: "rectangle",
          slant: 0.12,
          imageOpacity: 1,
        },
      ],
    }).success,
    false,
  );
});
