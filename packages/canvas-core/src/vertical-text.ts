import type { Rect } from "./types.js";
export type VerticalGlyph = {
  value: string;
  x: number;
  y: number;
  column: number;
  row: number;
  tateChuYoko: boolean;
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

const prohibitedAtColumnStart = new Set(
  segmentGraphemes(
    "、。，．・：；？！‼⁇⁈⁉ヽヾゝゞ々ー〜～）〕］｝〉》」』】〙〗〟’”｠»ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ",
  ),
);
const prohibitedAtColumnEnd = new Set(
  segmentGraphemes("（〔［｛〈《「『【〘〖〝‘“｟«"),
);

export type VerticalToken = { value: string; tateChuYoko: boolean };

export function tokenizeVerticalText(text: string): VerticalToken[] {
  const graphemes = segmentGraphemes(text);
  const tokens: VerticalToken[] = [];
  for (let index = 0; index < graphemes.length; index += 1) {
    const value = graphemes[index];
    if (/^[0-9]$/.test(value) && /^[0-9]$/.test(graphemes[index + 1] ?? "")) {
      tokens.push({ value: value + graphemes[index + 1], tateChuYoko: true });
      index += 1;
    } else tokens.push({ value, tateChuYoko: false });
  }
  return tokens;
}

function needsEarlyColumnBreak(
  current: VerticalToken,
  next: VerticalToken | undefined,
) {
  return (
    prohibitedAtColumnEnd.has(current.value) ||
    (next != null && prohibitedAtColumnStart.has(next.value))
  );
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
  const tokens = tokenizeVerticalText(text);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const value = token.value;
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
    if (
      rowsPerColumn > 1 &&
      row === rowsPerColumn - 1 &&
      needsEarlyColumnBreak(token, tokens[index + 1])
    ) {
      column += 1;
      row = 0;
    }
    glyphs.push({
      value: token.tateChuYoko ? value : verticalGlyph(value),
      x: box.x + box.width - options.fontSize / 2 - column * columnAdvance,
      y: box.y + options.fontSize / 2 + row * rowAdvance,
      column,
      row,
      tateChuYoko: token.tateChuYoko,
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
