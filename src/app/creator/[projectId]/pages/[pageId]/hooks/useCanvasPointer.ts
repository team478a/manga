"use client";

import {
  useRef,
  type Dispatch,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  constrainRectToPage,
  type Balloon,
  type PageCanvas,
  type Panel,
  type TextObject,
} from "@mangai/canvas-core";

export type CanvasSelection =
  | { type: "panel" | "balloon" | "text"; id: string }
  | null;
type CanvasItem = Panel | Balloon | TextObject;

function cloneCanvas(canvas: PageCanvas) {
  return structuredClone(canvas);
}

export function useCanvasPointer({
  canvas,
  setCanvas,
  canvasElement,
  setSelection,
  markDirty,
  recordSnapshot,
}: {
  canvas: PageCanvas;
  setCanvas: Dispatch<SetStateAction<PageCanvas>>;
  canvasElement: RefObject<HTMLDivElement | null>;
  setSelection: Dispatch<SetStateAction<CanvasSelection>>;
  markDirty: () => void;
  recordSnapshot: (canvas: PageCanvas) => void;
}) {
  const drag = useRef<{
    selection: Exclude<CanvasSelection, null>;
    startX: number;
    startY: number;
    objectX: number;
    objectY: number;
    before: PageCanvas;
  } | null>(null);

  function pointerDown(
    event: PointerEvent<HTMLElement>,
    nextSelection: Exclude<CanvasSelection, null>,
    item: CanvasItem,
  ) {
    event.stopPropagation();
    setSelection(nextSelection);
    if (item.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      selection: nextSelection,
      startX: event.clientX,
      startY: event.clientY,
      objectX: item.x,
      objectY: item.y,
      before: cloneCanvas(canvas),
    };
  }

  function pointerMove(event: PointerEvent<HTMLElement>) {
    if (!drag.current || !canvasElement.current) return;
    const scale = canvasElement.current.clientWidth / canvas.width;
    const x =
      drag.current.objectX + (event.clientX - drag.current.startX) / scale;
    const y =
      drag.current.objectY + (event.clientY - drag.current.startY) / scale;
    const active = drag.current.selection;
    setCanvas((current) => {
      const draft = cloneCanvas(current);
      const collection =
        active.type === "panel"
          ? draft.panels
          : active.type === "balloon"
            ? draft.balloons
            : draft.textObjects;
      const item = collection.find((candidate) => candidate.id === active.id);
      if (item) {
        const constrained = constrainRectToPage(
          { x, y, width: item.width, height: item.height },
          { width: canvas.width, height: canvas.height },
        );
        item.x = constrained.x;
        item.y = constrained.y;
      }
      return draft;
    });
    markDirty();
  }

  function pointerUp(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    recordSnapshot(drag.current.before);
    drag.current = null;
  }

  return { pointerDown, pointerMove, pointerUp };
}
