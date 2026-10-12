import {
  dialogueInnerRegion, dialogueRectInside, dialogueInkFitsTextBox,
  fitBalloonDialogueTextLayout, rotateDialoguePoint,
  type Balloon, type TextObject,
} from "@mangai/canvas-core";

export function planLinkedBalloonText(previous: Balloon, next: Balloon, texts: TextObject[]) {
  if (previous.pageId !== next.pageId) throw new Error("吹き出しのページを変更できません。");
  const changed = (["x", "y", "width", "height", "rotation", "type", "strokeWidth"] as const).some(key => previous[key] !== next[key]);
  const linked = texts.filter(text => text.parentBalloonId === previous.id);
  if (!changed) return [];
  if (previous.locked || linked.some(text => text.locked))
    throw new Error("吹き出しまたは関連文字がロックされています。");
  const region = dialogueInnerRegion(next);
  return linked.map(text => {
    const local = rotateDialoguePoint({ x: text.x - previous.x, y: text.y - previous.y }, -previous.rotation);
    const offset = rotateDialoguePoint({ x: local.x * next.width / previous.width, y: local.y * next.height / previous.height }, next.rotation);
    const moved = { ...text, x: next.x + offset.x, y: next.y + offset.y, width: text.width * next.width / previous.width, height: text.height * next.height / previous.height, rotation: text.rotation + next.rotation - previous.rotation };
    if (!text.text.trim() || (dialogueRectInside({ x: 0, y: 0, width: moved.width, height: moved.height }, moved, region) && dialogueInkFitsTextBox(moved))) return moved;
    const fit = fitBalloonDialogueTextLayout(text.text, next, text);
    // Keep full text/size and expose overflow if readable fitting is impossible.
    return fit ? { ...moved, ...region, ...fit } : moved;
  });
}
