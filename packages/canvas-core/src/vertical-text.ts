import type { Rect } from "./types.js";
export type VerticalGlyph = {
  value: string;
  x: number;
  y: number;
  column: number;
  row: number;
};
export function segmentGraphemes(value: string, locale = "ja") {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
    return [...segmenter.segment(value)].map((item) => item.segment);
  }
  return Array.from(value);
}
const verticalForms: Readonly<Record<string, string>> = {
  "、": "︑",
  "。": "︒",
  "（": "︵",
  "）": "︶",
  "「": "﹁",
  "」": "﹂",
  "『": "﹃",
  "』": "﹄",
  "【": "︻",
  "】": "︼",
  "…": "︙",
  "‥": "︰",
  ー: "｜",
  "―": "︱",
};
export function verticalGlyph(value: string) {
  return verticalForms[value] ?? value;
}
export function layoutVerticalText(
  text: string,
  box: Rect,
  options: { fontSize: number; lineHeight?: number; letterSpacing?: number },
) {
  const lineHeight = options.lineHeight ?? 1.2,
    letterSpacing = options.letterSpacing ?? 0,
    rowAdvance = options.fontSize * lineHeight + letterSpacing,
    columnAdvance = options.fontSize * lineHeight,
    rowsPerColumn = Math.max(1, Math.floor(box.height / rowAdvance)),
    glyphs: VerticalGlyph[] = [];
  let column = 0,
    row = 0;
  for (const value of segmentGraphemes(text)) {
    if (value === "\r") continue;
    if (value === "\n") {
      column += 1;
      row = 0;
      continue;
    }
    if (row >= rowsPerColumn) {
      column += 1;
      row = 0;
    }
    glyphs.push({
      value: verticalGlyph(value),
      x: box.x + box.width - options.fontSize / 2 - column * columnAdvance,
      y: box.y + options.fontSize / 2 + row * rowAdvance,
      column,
      row,
    });
    row += 1;
  }
  return {
    glyphs,
    columns: glyphs.length
      ? Math.max(...glyphs.map((glyph) => glyph.column)) + 1
      : 0,
    overflow: columnAdvance * (column + 1) > box.width,
  };
}
