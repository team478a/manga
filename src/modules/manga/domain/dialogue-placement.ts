import {
  layoutHorizontalText,
  layoutVerticalText,
  parseRubyText,
  segmentGraphemes,
  type Balloon,
  type PageCanvas,
  type Panel,
  type TextObject,
} from "@mangai/canvas-core";

export type StructuredPanelDialogue = {
  type: "speech" | "thought" | "narration" | "sound_effect";
  speaker: string;
  text: string;
};

export type StructuredPageDialogue = {
  panelIndex: number;
  dialogues: StructuredPanelDialogue[];
};

export type DialoguePlacementBlocker =
  | "panel_missing"
  | "panel_locked"
  | "balloon_locked"
  | "text_locked"
  | "manual_text_present"
  | "unlinked_existing_text"
  | "dialogue_does_not_fit"
  | "page_finalized";

export type DialoguePlacementResult = {
  canvas: PageCanvas;
  changed: boolean;
  dialogueCount: number;
  placedDialogueCount: number;
  blockers: DialoguePlacementBlocker[];
};

const MAX_FONT_SIZE = 32;
const MIN_FONT_SIZE = 18;
const PREFERRED_MIN_FONT_SIZE = 24;
const TEXT_PADDING = 10;

type DialogueTextLayout = Pick<
  TextObject,
  "fontSize" | "writingMode" | "textAlign" | "verticalAlign"
>;

function centerInsidePanel(
  value: Pick<Balloon | TextObject, "x" | "y" | "width" | "height">,
  panel: Panel,
) {
  const x = value.x + value.width / 2;
  const y = value.y + value.height / 2;
  return (
    x >= panel.x &&
    x <= panel.x + panel.width &&
    y >= panel.y &&
    y <= panel.y + panel.height
  );
}

function readingOrder(a: Balloon, b: Balloon) {
  const rowTolerance = Math.max(24, Math.min(a.height, b.height) * 0.45);
  if (Math.abs(a.y - b.y) > rowTolerance) return a.y - b.y;
  return b.x - a.x;
}

function fitDialogueTextLayout(text: string, balloon: Balloon): DialogueTextLayout | null {
  const box = {
    x: balloon.x + TEXT_PADDING,
    y: balloon.y + TEXT_PADDING,
    width: Math.max(1, balloon.width - TEXT_PADDING * 2),
    height: Math.max(1, balloon.height - TEXT_PADDING * 2),
  };
  const plainText = parseRubyText(text).plainText;
  const preferSingleColumn =
    !/[\r\n]/u.test(plainText) && segmentGraphemes(plainText).length <= 6;
  let largestReadableSize: number | null = null;
  let singleColumnSize: number | null = null;
  for (let fontSize = MAX_FONT_SIZE; fontSize >= MIN_FONT_SIZE; fontSize -= 2) {
    const layout = layoutVerticalText(text, box, {
      fontSize,
      lineHeight: 1.2,
      letterSpacing: 0,
    });
    if (layout.overflow) continue;
    largestReadableSize ??= fontSize;
    if (!preferSingleColumn)
      return {
        fontSize,
        writingMode: "vertical",
        textAlign: "start",
        verticalAlign: "top",
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
      const layout = layoutHorizontalText(text, box, {
        fontSize,
        lineHeight: 1.2,
        letterSpacing: 0,
        textAlign: "center",
        verticalAlign: "middle",
      });
      if (!layout.overflow && layout.lines.length === 1)
        return {
          fontSize,
          writingMode: "horizontal",
          textAlign: "center",
          verticalAlign: "middle",
        };
    }
  }
  if (singleColumnSize != null)
    return {
      fontSize: singleColumnSize,
      writingMode: "vertical",
      textAlign: "start",
      verticalAlign: "top",
    };
  return largestReadableSize == null
    ? null
    : {
        fontSize: largestReadableSize,
        writingMode: "vertical",
        textAlign: "start",
        verticalAlign: "top",
      };
}

function textLayoutBox(text: TextObject) {
  const padding = Math.max(0, text.padding);
  return {
    x: text.x + padding,
    y: text.y + padding,
    width: Math.max(1, text.width - padding * 2),
    height: Math.max(1, text.height - padding * 2),
  };
}

function shortVerticalDialogueRepairLayout(
  canvas: PageCanvas,
  text: TextObject,
) {
  const plainText = parseRubyText(text.text).plainText;
  if (
    text.writingMode !== "vertical" ||
    !text.visible ||
    text.locked ||
    !text.parentBalloonId ||
    /[\r\n]/u.test(plainText) ||
    segmentGraphemes(plainText).length > 6 ||
    !plainText.trim()
  )
    return null;
  const balloon = canvas.balloons.find(
    (item) => item.id === text.parentBalloonId,
  );
  if (!balloon || !balloon.visible || balloon.locked) return null;
  const box = textLayoutBox(text);
  const currentLayout = layoutVerticalText(text.text, box, {
    fontSize: text.fontSize,
    lineHeight: text.lineHeight,
    letterSpacing: text.letterSpacing,
  });
  if (!currentLayout.overflow && currentLayout.columns <= 1) return null;
  return fitDialogueTextLayout(text.text, {
    ...balloon,
    x: text.x - TEXT_PADDING,
    y: text.y - TEXT_PADDING,
    width: text.width + TEXT_PADDING * 2,
    height: text.height + TEXT_PADDING * 2,
  });
}

export function isDialogueTextLayoutReadable(text: TextObject) {
  if (!text.visible || !text.text.trim()) return false;
  const box = textLayoutBox(text);
  const plainText = parseRubyText(text.text).plainText;
  const shortText =
    !/[\r\n]/u.test(plainText) && segmentGraphemes(plainText).length <= 6;
  if (text.writingMode === "vertical") {
    const layout = layoutVerticalText(text.text, box, {
      fontSize: text.fontSize,
      lineHeight: text.lineHeight,
      letterSpacing: text.letterSpacing,
    });
    return !layout.overflow && (!shortText || layout.columns === 1);
  }
  const layout = layoutHorizontalText(text.text, box, {
    fontSize: text.fontSize,
    lineHeight: text.lineHeight,
    letterSpacing: text.letterSpacing,
    textAlign: text.textAlign,
    verticalAlign: text.verticalAlign,
  });
  return !layout.overflow && (!shortText || layout.lines.length === 1);
}

export function countRepairableShortVerticalDialogue(canvas: PageCanvas) {
  return canvas.textObjects.filter(
    (text) => shortVerticalDialogueRepairLayout(canvas, text) != null,
  ).length;
}

export function repairShortVerticalDialogueLayout(
  canvas: PageCanvas,
  timestamp: string,
) {
  let repairedTextCount = 0;
  for (const text of canvas.textObjects) {
    const layout = shortVerticalDialogueRepairLayout(canvas, text);
    if (layout == null) continue;
    text.fontSize = layout.fontSize;
    text.writingMode = layout.writingMode;
    text.textAlign = layout.textAlign;
    text.verticalAlign = layout.verticalAlign;
    text.updatedAt = timestamp;
    repairedTextCount += 1;
  }
  return repairedTextCount;
}

function linkedDialogueBoundsRepair(
  canvas: PageCanvas,
  text: TextObject,
) {
  if (!text.visible || text.locked || !text.parentBalloonId || !text.text.trim())
    return null;
  const balloon = canvas.balloons.find((item) => item.id === text.parentBalloonId);
  if (!balloon || !balloon.visible || balloon.locked) return null;
  const expected = {
    x: balloon.x + TEXT_PADDING,
    y: balloon.y + TEXT_PADDING,
    width: Math.max(1, balloon.width - TEXT_PADDING * 2),
    height: Math.max(1, balloon.height - TEXT_PADDING * 2),
  };
  const withinBalloon =
    text.x >= expected.x &&
    text.y >= expected.y &&
    text.x + text.width <= expected.x + expected.width &&
    text.y + text.height <= expected.y + expected.height;
  if (withinBalloon) return null;
  const layout = fitDialogueTextLayout(text.text, balloon);
  return layout == null ? null : { ...expected, ...layout };
}

export function countRepairableLinkedDialogueBounds(canvas: PageCanvas) {
  return canvas.textObjects.filter(
    (text) => linkedDialogueBoundsRepair(canvas, text) != null,
  ).length;
}

export function repairLinkedDialogueBounds(canvas: PageCanvas, timestamp: string) {
  let repairedTextCount = 0;
  for (const text of canvas.textObjects) {
    const repair = linkedDialogueBoundsRepair(canvas, text);
    if (repair == null) continue;
    Object.assign(text, repair, { updatedAt: timestamp });
    repairedTextCount += 1;
  }
  return repairedTextCount;
}

function createDefaultBalloon(input: {
  panel: Panel;
  dialogue: StructuredPanelDialogue;
  dialogueIndex: number;
  dialogueCount: number;
  pageId: string;
  createId: () => string;
  now: string;
}): Balloon | null {
  const margin = Math.max(12, Math.min(36, input.panel.width * 0.05));
  const narration = input.dialogue.type === "narration";
  const width = Math.min(
    Math.max(120, input.panel.width * (narration ? 0.62 : 0.44)),
    input.panel.width - margin * 2,
  );
  const availableHeight = input.panel.height - margin * 2;
  const height = Math.min(
    Math.max(84, availableHeight / Math.max(1, input.dialogueCount) - 12),
    narration ? 150 : 190,
    availableHeight,
  );
  if (width < 72 || height < 56) return null;
  const slotHeight = availableHeight / Math.max(1, input.dialogueCount);
  const placeOnRight = input.dialogueIndex % 2 === 0;
  const x = placeOnRight
    ? input.panel.x + input.panel.width - margin - width
    : input.panel.x + margin;
  const y = Math.min(
    input.panel.y + input.panel.height - margin - height,
    input.panel.y + margin + input.dialogueIndex * slotHeight,
  );
  return {
    id: input.createId(),
    pageId: input.pageId,
    name: `${input.dialogue.speaker || "セリフ"} ${input.dialogueIndex + 1}`,
    type:
      input.dialogue.type === "narration"
        ? "narration_box"
        : input.dialogue.type === "thought"
          ? "speech_rounded"
          : "speech_ellipse",
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex: 100 + input.panel.zIndex * 10 + input.dialogueIndex * 2,
    visible: true,
    locked: false,
    fillColor: "#ffffff",
    strokeColor: "#111111",
    strokeWidth: 3,
    opacity: 1,
    tailDirection:
      input.dialogue.type === "narration"
        ? "none"
        : placeOnRight
          ? "bottom_right"
          : "bottom_left",
    tailOffset: 0.5,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function addUniqueBlocker(
  blockers: DialoguePlacementBlocker[],
  blocker: DialoguePlacementBlocker,
) {
  if (!blockers.includes(blocker)) blockers.push(blocker);
}

export function placeStructuredPageDialogue(input: {
  canvas: PageCanvas;
  panels: StructuredPageDialogue[];
  createId: () => string;
  now: string;
}): DialoguePlacementResult {
  const canvas = structuredClone(input.canvas);
  const blockers: DialoguePlacementBlocker[] = [];
  let dialogueCount = 0;
  let placedDialogueCount = 0;
  let changed = false;

  for (const sourcePanel of input.panels) {
    dialogueCount += sourcePanel.dialogues.length;
    const panel = canvas.panels[sourcePanel.panelIndex];
    if (!panel) {
      if (sourcePanel.dialogues.length) addUniqueBlocker(blockers, "panel_missing");
      continue;
    }
    if (panel.locked && sourcePanel.dialogues.length) {
      addUniqueBlocker(blockers, "panel_locked");
      continue;
    }
    const panelBalloons = canvas.balloons
      .filter((balloon) => centerInsidePanel(balloon, panel))
      .sort(readingOrder);
    const unlinkedTexts = canvas.textObjects.filter(
      (text) => !text.parentBalloonId && text.text.trim() && centerInsidePanel(text, panel),
    );

    for (let dialogueIndex = 0; dialogueIndex < sourcePanel.dialogues.length; dialogueIndex += 1) {
      const dialogue = sourcePanel.dialogues[dialogueIndex];
      const expectedText = dialogue.text.trim();
      if (!expectedText) continue;
      if (dialogue.type === "sound_effect") {
        addUniqueBlocker(blockers, "unlinked_existing_text");
        continue;
      }
      if (unlinkedTexts.some((text) => text.text.trim() === expectedText)) {
        addUniqueBlocker(blockers, "unlinked_existing_text");
        continue;
      }

      let balloon: Balloon | undefined = panelBalloons[dialogueIndex];
      let createdBalloon = false;
      if (!balloon) {
        balloon = createDefaultBalloon({
          panel,
          dialogue,
          dialogueIndex,
          dialogueCount: sourcePanel.dialogues.length,
          pageId: canvas.pageId,
          createId: input.createId,
          now: input.now,
        }) ?? undefined;
        if (!balloon) {
          addUniqueBlocker(blockers, "dialogue_does_not_fit");
          continue;
        }
        canvas.balloons.push(balloon);
        panelBalloons.push(balloon);
        createdBalloon = true;
      }
      const attached = canvas.textObjects.filter(
        (text) => text.parentBalloonId === balloon!.id,
      );
      if (attached.some((text) => text.text.trim() === expectedText)) {
        placedDialogueCount += 1;
        continue;
      }
      if (balloon.locked) {
        addUniqueBlocker(blockers, "balloon_locked");
        continue;
      }
      if (attached.some((text) => text.locked)) {
        addUniqueBlocker(blockers, "text_locked");
        continue;
      }
      if (attached.some((text) => text.text.trim())) {
        addUniqueBlocker(blockers, "manual_text_present");
        continue;
      }
      const textLayout = fitDialogueTextLayout(expectedText, balloon);
      if (textLayout == null) {
        if (createdBalloon) {
          canvas.balloons = canvas.balloons.filter(
            (candidate) => candidate.id !== balloon!.id,
          );
          panelBalloons.splice(panelBalloons.indexOf(balloon), 1);
        }
        addUniqueBlocker(blockers, "dialogue_does_not_fit");
        continue;
      }
      const reusableText = attached.find((text) => !text.text.trim());
      const placedText: TextObject = {
        id: reusableText?.id ?? input.createId(),
        pageId: canvas.pageId,
        parentBalloonId: balloon.id,
        name: `${dialogue.speaker || "セリフ"} テキスト`,
        text: expectedText,
        x: balloon.x + TEXT_PADDING,
        y: balloon.y + TEXT_PADDING,
        width: balloon.width - TEXT_PADDING * 2,
        height: balloon.height - TEXT_PADDING * 2,
        rotation: 0,
        zIndex: balloon.zIndex + 1,
        visible: true,
        locked: false,
        fontFamily: "sans-serif",
        fontSize: textLayout.fontSize,
        fontWeight: 500,
        color: "#111111",
        writingMode: textLayout.writingMode,
        textAlign: textLayout.textAlign,
        verticalAlign: textLayout.verticalAlign,
        lineHeight: 1.2,
        letterSpacing: 0,
        padding: 0,
        opacity: 1,
        createdAt: reusableText?.createdAt ?? input.now,
        updatedAt: input.now,
      };
      if (reusableText)
        canvas.textObjects[canvas.textObjects.indexOf(reusableText)] = placedText;
      else canvas.textObjects.push(placedText);
      placedDialogueCount += 1;
      changed = true;
    }
  }
  return { canvas, changed, dialogueCount, placedDialogueCount, blockers };
}
