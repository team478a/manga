import {
  fitBalloonDialogueTextLayout as fitDialogueTextLayout,
  layoutHorizontalText,
  layoutVerticalText,
  parseRubyText,
  segmentGraphemes,
  type Balloon,
  type PageCanvas,
  type Panel,
  type TextObject,
} from "@mangai/canvas-core";
import { dialogueInnerRegion, dialogueRectInside, dialogueInkFitsTextBox, rotateDialoguePoint } from "./dialogue-region.ts";

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

const TEXT_PADDING = 10;

function dialogueTextBounds(balloon: Balloon) {
  return dialogueInnerRegion(balloon);
}

export function isDialogueTextContainedInBalloon(
  text: TextObject,
  balloon: Balloon,
) {
  const bounds = dialogueTextBounds(balloon);
  return dialogueRectInside({ x: 0, y: 0, width: text.width, height: text.height }, text, bounds) && dialogueInkFitsTextBox(text);
}

export function moveBalloonWithLinkedDialogue(
  canvas: PageCanvas,
  balloonId: string,
  position: { x: number; y: number },
) {
  const balloon = canvas.balloons.find((item) => item.id === balloonId);
  if (!balloon || balloon.locked || canvas.textObjects.some(text => text.parentBalloonId === balloonId && text.locked)) return false;
  const attached = canvas.textObjects.filter(text => text.parentBalloonId === balloonId);
  const points = [balloon, ...attached].flatMap(item => [[0, 0], [item.width, 0], [0, item.height], [item.width, item.height]].map(([x, y]) => {
    const point = rotateDialoguePoint({ x, y }, item.rotation);
    return { x: item.x + point.x, y: item.y + point.y };
  }));
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  if (maxX - minX > canvas.width || maxY - minY > canvas.height) return false;
  const deltaX = Math.max(-minX, Math.min(canvas.width - maxX, position.x - balloon.x));
  const deltaY = Math.max(-minY, Math.min(canvas.height - maxY, position.y - balloon.y));
  balloon.x += deltaX;
  balloon.y += deltaY;
  for (const text of canvas.textObjects) {
    if (text.parentBalloonId !== balloonId) continue;
    text.x += deltaX;
    text.y += deltaY;
  }
  return true;
}

export function transformBalloonWithLinkedDialogue(canvas: PageCanvas, balloonId: string, next: Balloon, timestamp: string) {
  const balloon = canvas.balloons.find(item => item.id === balloonId);
  if (!balloon || balloon.locked || canvas.textObjects.some(text => text.parentBalloonId === balloonId && text.locked)) return false;
  const previous = { ...balloon };
  for (const text of canvas.textObjects) {
    if (text.parentBalloonId !== balloonId) continue;
    const local = rotateDialoguePoint({ x: text.x - previous.x, y: text.y - previous.y }, -previous.rotation);
    const offset = rotateDialoguePoint(local, next.rotation);
    text.x = next.x + offset.x;
    text.y = next.y + offset.y;
    text.rotation += next.rotation - previous.rotation;
    text.updatedAt = timestamp;
  }
  Object.assign(balloon, next, { updatedAt: timestamp });
  // Only the changed balloon: never repair unrelated manual text during editing.
  for (const text of canvas.textObjects.filter(item => item.parentBalloonId === balloonId)) {
    const repair = linkedDialogueBoundsRepair(canvas, text);
    if (repair) Object.assign(text, repair, { updatedAt: timestamp });
  }
  return true;
}

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
    type: "narration_box",
    strokeWidth: 0,
  }, text);
}

export function isDialogueTextLayoutReadable(text: TextObject) {
  if (!text.visible || !text.text.trim() || !dialogueInkFitsTextBox(text)) return false;
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
    text.padding = layout.padding;
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
  const expected = dialogueTextBounds(balloon);
  const withinBalloon = isDialogueTextContainedInBalloon(text, balloon) && isDialogueTextLayoutReadable(text);
  if (withinBalloon) return null;
  const layout = fitDialogueTextLayout(text.text, balloon, text);
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
        ...dialogueTextBounds(balloon),
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
        padding: textLayout.padding,
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
