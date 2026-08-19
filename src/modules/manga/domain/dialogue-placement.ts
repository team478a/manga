import {
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
const TEXT_PADDING = 10;

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

function fitFontSize(text: string, balloon: Balloon) {
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
  for (let fontSize = MAX_FONT_SIZE; fontSize >= MIN_FONT_SIZE; fontSize -= 2) {
    const layout = layoutVerticalText(text, box, {
      fontSize,
      lineHeight: 1.2,
      letterSpacing: 0,
    });
    if (layout.overflow) continue;
    largestReadableSize ??= fontSize;
    if (!preferSingleColumn || layout.columns === 1) return fontSize;
  }
  return largestReadableSize;
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
      const fontSize = fitFontSize(expectedText, balloon);
      if (fontSize == null) {
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
        fontSize,
        fontWeight: 500,
        color: "#111111",
        writingMode: "vertical",
        textAlign: "start",
        verticalAlign: "top",
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
