import type { Rect } from "./types.js";
export type VerticalGlyph = {
  value: string;
  x: number;
  y: number;
  column: number;
  row: number;
  tateChuYoko: boolean;
  sourceStart: number;
  sourceLength: number;
};
export type VerticalRubyGlyph = {
  value: string;
  x: number;
  y: number;
  column: number;
};
export type RubyAnnotation = {
  base: string;
  reading: string;
  start: number;
  length: number;
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

export function parseRubyText(value: string) {
  const annotations: RubyAnnotation[] = [];
  let plainText = "";
  let cursor = 0;
  let plainLength = 0;
  const expression = /｜([^｜《》\r\n]{1,50})《([^｜《》\r\n]{1,100})》/gu;
  for (const match of value.matchAll(expression)) {
    const index = match.index ?? 0;
    const prefix = value.slice(cursor, index);
    plainText += prefix;
    plainLength += segmentGraphemes(prefix).length;
    const base = match[1];
    const baseLength = segmentGraphemes(base).length;
    plainText += base;
    annotations.push({
      base,
      reading: match[2],
      start: plainLength,
      length: baseLength,
    });
    plainLength += baseLength;
    cursor = index + match[0].length;
  }
  plainText += value.slice(cursor);
  return { plainText, annotations };
}

const prohibitedAtColumnStart = new Set(
  segmentGraphemes(
    "、。，．・：；？！‼⁇⁈⁉ヽヾゝゞ々ー〜～）〕］｝〉》」』】〙〗〟’”｠»ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ",
  ),
);
const prohibitedAtColumnEnd = new Set(
  segmentGraphemes("（〔［｛〈《「『【〘〖〝‘“｟«"),
);

export type VerticalToken = {
  value: string;
  tateChuYoko: boolean;
  sourceStart: number;
  sourceLength: number;
};

export function tokenizeVerticalText(text: string): VerticalToken[] {
  const graphemes = segmentGraphemes(text);
  const tokens: VerticalToken[] = [];
  for (let index = 0; index < graphemes.length; index += 1) {
    const value = graphemes[index];
    if (/^[0-9]$/.test(value) && /^[0-9]$/.test(graphemes[index + 1] ?? "")) {
      tokens.push({
        value: value + graphemes[index + 1],
        tateChuYoko: true,
        sourceStart: index,
        sourceLength: 2,
      });
      index += 1;
    } else
      tokens.push({
        value,
        tateChuYoko: false,
        sourceStart: index,
        sourceLength: 1,
      });
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
    glyphs: VerticalGlyph[] = [],
    rubyGlyphs: VerticalRubyGlyph[] = [];
  let column = 0,
    row = 0;
  const parsed = parseRubyText(text);
  const tokens = tokenizeVerticalText(parsed.plainText);
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
      sourceStart: token.sourceStart,
      sourceLength: token.sourceLength,
    });
    row += 1;
  }
  for (const annotation of parsed.annotations) {
    const end = annotation.start + annotation.length;
    const bases = glyphs.filter(
      (glyph) =>
        glyph.sourceStart < end &&
        glyph.sourceStart + glyph.sourceLength > annotation.start,
    );
    const readings = segmentGraphemes(annotation.reading);
    if (!bases.length || !readings.length) continue;
    for (let index = 0; index < readings.length; index += 1) {
      const baseIndex = Math.min(
        bases.length - 1,
        Math.floor((index * bases.length) / readings.length),
      );
      const base = bases[baseIndex];
      const sameBaseReadings = readings.filter(
        (_, readingIndex) =>
          Math.min(
            bases.length - 1,
            Math.floor((readingIndex * bases.length) / readings.length),
          ) === baseIndex,
      );
      const indexWithinBase =
        index -
        readings.findIndex(
          (_, readingIndex) =>
            Math.min(
              bases.length - 1,
              Math.floor((readingIndex * bases.length) / readings.length),
            ) === baseIndex,
        );
      const rubyAdvance = options.fontSize * 0.46;
      rubyGlyphs.push({
        value: readings[index],
        x: base.x + options.fontSize * 0.68,
        y:
          base.y +
          (indexWithinBase - (sameBaseReadings.length - 1) / 2) * rubyAdvance,
        column: base.column,
      });
    }
  }
  return {
    glyphs,
    rubyGlyphs,
    columns: glyphs.length
      ? Math.max(...glyphs.map((glyph) => glyph.column)) + 1
      : 0,
    overflow: columnAdvance * (column + 1) > box.width,
  };
}
