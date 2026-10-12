import { layoutHorizontalText } from "./horizontal-text.js";
import { layoutVerticalText, parseRubyText, segmentGraphemes } from "./vertical-text.js";
import type { Balloon, TextObject } from "./types.js";
import { dialogueInnerRegion, dialogueInkFitsTextBox } from "./dialogue-region.js";

const MAX_FONT_SIZE = 32;
const MIN_FONT_SIZE = 18;
const PREFERRED_MIN_FONT_SIZE = 24;
type DialogueTextLayout = Pick<
  TextObject,
  "fontSize" | "writingMode" | "textAlign" | "verticalAlign" | "padding"
>;

export function fitBalloonDialogueTextLayout(text: string, balloon: Balloon, metrics: { lineHeight: number; letterSpacing: number } = { lineHeight: 1.2, letterSpacing: 0 }): DialogueTextLayout | null {
  const { lineHeight, letterSpacing } = metrics;
  const box = dialogueInnerRegion(balloon);
  if (box.width <= 0 || box.height <= 0) return null;
  const plainText = parseRubyText(text).plainText;
  const hasRuby = parseRubyText(text).annotations.length > 0;
  const fits = (fontSize: number, writingMode: TextObject["writingMode"], textAlign: TextObject["textAlign"], verticalAlign: TextObject["verticalAlign"]) => dialogueInkFitsTextBox({ text, width: box.width, height: box.height, fontSize, writingMode, textAlign, verticalAlign, padding: hasRuby ? fontSize : 0, lineHeight, letterSpacing });
  const preferSingleColumn =
    !/[\r\n]/u.test(plainText) && segmentGraphemes(plainText).length <= 6;
  let singleColumnSize: number | null = null;
  for (let fontSize = MAX_FONT_SIZE; fontSize >= MIN_FONT_SIZE; fontSize -= 2) {
    const padding = hasRuby ? fontSize : 0;
    const layout = layoutVerticalText(text, { ...box, width: box.width - padding * 2, height: box.height - padding * 2 }, {
      fontSize,
      lineHeight, letterSpacing,
    });
    if (layout.overflow || !fits(fontSize, "vertical", "start", "top")) continue;
    if (!preferSingleColumn)
      return {
        fontSize,
        writingMode: "vertical",
        textAlign: "start",
        verticalAlign: "top",
        padding,
      };
    if (layout.columns === 1) {
      singleColumnSize = fontSize;
      break;
    }
  }
  if (preferSingleColumn && box.width >= box.height * 1.5) {
    for (
      let fontSize = MAX_FONT_SIZE;
      fontSize >= PREFERRED_MIN_FONT_SIZE;
      fontSize -= 2
    ) {
      const padding = hasRuby ? fontSize : 0;
      const layout = layoutHorizontalText(text, { ...box, width: box.width - padding * 2, height: box.height - padding * 2 }, {
        fontSize,
        lineHeight, letterSpacing,
        textAlign: "center",
        verticalAlign: "middle",
      });
      if (!layout.overflow && layout.lines.length === 1 && fits(fontSize, "horizontal", "center", "middle"))
        return {
          fontSize,
          writingMode: "horizontal",
          textAlign: "center",
          verticalAlign: "middle",
          padding: hasRuby ? fontSize : 0,
        };
    }
  }
  if (singleColumnSize != null)
    return {
      fontSize: singleColumnSize,
      writingMode: "vertical",
      textAlign: "start",
      verticalAlign: "top",
      padding: hasRuby ? singleColumnSize : 0,
    };
  return null;
}
