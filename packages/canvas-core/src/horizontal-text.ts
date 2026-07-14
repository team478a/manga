import type { Rect } from "./types.js";
import {
  parseRubyText,
  segmentGraphemes,
  type RubyAnnotation,
} from "./vertical-text.js";

export type HorizontalTextLine = {
  value: string;
  x: number;
  y: number;
  width: number;
};

export type HorizontalRubyRun = {
  value: string;
  x: number;
  y: number;
  width: number;
  line: number;
};

type SourceGlyph = {
  value: string;
  sourceIndex: number;
  advance: number;
};

function glyphAdvance(value: string, fontSize: number, letterSpacing: number) {
  const ratio = /^[\u0000-\u00ff]$/u.test(value) ? 0.55 : 1;
  return Math.max(1, fontSize * ratio + letterSpacing);
}

export function layoutHorizontalText(
  text: string,
  box: Rect,
  options: {
    fontSize: number;
    lineHeight?: number;
    letterSpacing?: number;
    textAlign?: "start" | "center" | "end";
    verticalAlign?: "top" | "middle" | "bottom";
  },
) {
  const parsed = parseRubyText(text);
  const graphemes = segmentGraphemes(parsed.plainText);
  const lineHeight = options.lineHeight ?? 1.2;
  const letterSpacing = options.letterSpacing ?? 0;
  const lineAdvance = options.fontSize * lineHeight;
  const lines: SourceGlyph[][] = [[]];
  const annotationsByStart = new Map<number, RubyAnnotation>(
    parsed.annotations.map((annotation) => [annotation.start, annotation]),
  );
  let lineWidth = 0;
  const pushLine = () => {
    lines.push([]);
    lineWidth = 0;
  };
  const appendGlyph = (value: string, sourceIndex: number) => {
    const advance = glyphAdvance(value, options.fontSize, letterSpacing);
    if (lineWidth > 0 && lineWidth + advance > box.width) pushLine();
    lines[lines.length - 1].push({ value, sourceIndex, advance });
    lineWidth += advance;
  };

  for (let index = 0; index < graphemes.length; index += 1) {
    const value = graphemes[index];
    if (value === "\r") continue;
    if (value === "\n") {
      pushLine();
      continue;
    }
    const annotation = annotationsByStart.get(index);
    if (annotation) {
      const base = graphemes.slice(index, index + annotation.length);
      const baseWidth = base.reduce(
        (total, glyph) =>
          total + glyphAdvance(glyph, options.fontSize, letterSpacing),
        0,
      );
      if (lineWidth > 0 && lineWidth + baseWidth > box.width) pushLine();
      for (let offset = 0; offset < base.length; offset += 1)
        appendGlyph(base[offset], index + offset);
      index += annotation.length - 1;
      continue;
    }
    appendGlyph(value, index);
  }
  const contentHeight = lines.length * lineAdvance;
  const startY =
    options.verticalAlign === "middle"
      ? box.y + (box.height - contentHeight) / 2 + options.fontSize
      : options.verticalAlign === "bottom"
        ? box.y + box.height - contentHeight + options.fontSize
        : box.y + options.fontSize;
  const resultLines: HorizontalTextLine[] = [];
  const rubyRuns: HorizontalRubyRun[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const glyphs = lines[lineIndex];
    const width = glyphs.reduce((total, glyph) => total + glyph.advance, 0);
    const x =
      options.textAlign === "center"
        ? box.x + (box.width - width) / 2
        : options.textAlign === "end"
          ? box.x + box.width - width
          : box.x;
    const y = startY + lineIndex * lineAdvance;
    resultLines.push({
      value: glyphs.map((glyph) => glyph.value).join(""),
      x,
      y,
      width,
    });
    for (const annotation of parsed.annotations) {
      const bases = glyphs.filter(
        (glyph) =>
          glyph.sourceIndex >= annotation.start &&
          glyph.sourceIndex < annotation.start + annotation.length,
      );
      if (!bases.length) continue;
      const first = glyphs.indexOf(bases[0]);
      const beforeWidth = glyphs
        .slice(0, first)
        .reduce((total, glyph) => total + glyph.advance, 0);
      const baseWidth = bases.reduce(
        (total, glyph) => total + glyph.advance,
        0,
      );
      rubyRuns.push({
        value: annotation.reading,
        x: x + beforeWidth + baseWidth / 2,
        y: y - options.fontSize * 0.82,
        width: baseWidth,
        line: lineIndex,
      });
    }
  }
  return {
    plainText: parsed.plainText,
    lines: resultLines,
    rubyRuns,
    overflow: contentHeight > box.height,
  };
}
