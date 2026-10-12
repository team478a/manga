import { layoutHorizontalText } from "./horizontal-text.js";
import { layoutVerticalText, segmentGraphemes } from "./vertical-text.js";
import type { Balloon, TextObject } from "./types.js";

type Rect = { x: number; y: number; width: number; height: number };
type Transform = Rect & { rotation: number };
const EPSILON = 0.01;

// Canvas schema/export uses a top-left rotation pivot, not the CSS default center.
export function rotateDialoguePoint(point: { x: number; y: number }, degrees: number) {
  const radians = degrees * Math.PI / 180;
  return { x: point.x * Math.cos(radians) - point.y * Math.sin(radians), y: point.x * Math.sin(radians) + point.y * Math.cos(radians) };
}

export function dialogueInnerRegion(balloon: Balloon): Transform {
  const padding = Math.max(10, balloon.strokeWidth / 2 + 4);
  const ellipse = balloon.type === "speech_ellipse";
  // All four corners of this rectangle lie inside the inset ellipse. Rounded
  // corners use the same 30px radius as SVG export; tails are never text space.
  const roundedInset = balloon.type === "speech_rounded" ? Math.min(30, balloon.width / 2, balloon.height / 2) * (1 - Math.SQRT1_2) : 0;
  const width = ellipse ? (balloon.width - padding * 2) * Math.SQRT1_2 : balloon.width - (padding + roundedInset) * 2;
  const height = ellipse ? (balloon.height - padding * 2) * Math.SQRT1_2 : balloon.height - (padding + roundedInset) * 2;
  const offset = rotateDialoguePoint({ x: (balloon.width - width) / 2, y: (balloon.height - height) / 2 }, balloon.rotation);
  return { x: balloon.x + offset.x, y: balloon.y + offset.y, width, height, rotation: balloon.rotation };
}

export function dialogueRectInside(rect: Rect, transform: Transform, region: Transform) {
  if (![rect.x, rect.y, rect.width, rect.height, transform.x, transform.y, transform.rotation, region.x, region.y, region.width, region.height, region.rotation].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0 || region.width <= 0 || region.height <= 0) return false;
  return [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x, rect.y + rect.height], [rect.x + rect.width, rect.y + rect.height]].every(([x, y]) => {
    const world = rotateDialoguePoint({ x, y }, transform.rotation);
    const local = rotateDialoguePoint({ x: world.x + transform.x - region.x, y: world.y + transform.y - region.y }, -region.rotation);
    return local.x >= -EPSILON && local.y >= -EPSILON && local.x <= region.width + EPSILON && local.y <= region.height + EPSILON;
  });
}

export type DialogueMetrics = Pick<TextObject, "text" | "width" | "height" | "fontSize" | "padding" | "writingMode" | "lineHeight" | "letterSpacing" | "textAlign" | "verticalAlign">;

// Conservative em-cell/line bounds, including ruby; never test just centers.
export function dialogueInkFitsTextBox(text: DialogueMetrics) {
  if (![text.fontSize, text.padding, text.width, text.height, text.lineHeight, text.letterSpacing].every(Number.isFinite) || text.padding < 0 || text.lineHeight < 1 || text.fontSize * text.lineHeight + text.letterSpacing < text.fontSize) return false;
  const box = { x: text.padding, y: text.padding, width: text.width - text.padding * 2, height: text.height - text.padding * 2 };
  const region = { x: 0, y: 0, width: text.width, height: text.height, rotation: 0 };
  const origin = { ...region, x: 0, y: 0 };
  if (box.width <= 0 || box.height <= 0 || text.fontSize < 18) return false;
  const fits = (rect: Rect) => dialogueRectInside(rect, origin, region);
  if (text.writingMode === "vertical") {
    const layout = layoutVerticalText(text.text, box, text);
    return !layout.overflow && layout.glyphs.every(glyph => fits({ x: glyph.x - text.fontSize / 2, y: glyph.y - text.fontSize / 2, width: text.fontSize, height: text.fontSize })) && layout.rubyGlyphs.every(glyph => fits({ x: glyph.x - text.fontSize * 0.21, y: glyph.y - text.fontSize * 0.21, width: text.fontSize * 0.42, height: text.fontSize * 0.42 }));
  }
  const layout = layoutHorizontalText(text.text, box, text);
  return !layout.overflow && layout.lines.every(line => !line.value || fits({ x: line.x, y: line.y - text.fontSize, width: Math.max(1, line.width), height: text.fontSize * 1.2 })) && layout.rubyRuns.every(run => {
    const width = segmentGraphemes(run.value).reduce((sum, glyph) => sum + text.fontSize * 0.42 * (/^[\u0000-\u00ff]$/u.test(glyph) ? 0.55 : 1), 0);
    return fits({ x: run.x - width / 2, y: run.y - text.fontSize * 0.42, width, height: text.fontSize * 0.52 });
  });
}
