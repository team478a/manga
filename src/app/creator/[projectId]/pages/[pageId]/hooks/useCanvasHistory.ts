"use client";

import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { pageCanvasSchema, type PageCanvas } from "@mangai/canvas-core";

function cloneCanvas(canvas: PageCanvas) {
  return structuredClone(canvas);
}

export type CanvasHistoryStore = {
  undo: PageCanvas[];
  redo: PageCanvas[];
};

export function createCanvasHistoryStore(): CanvasHistoryStore {
  return { undo: [], redo: [] };
}

export function recordCanvasSnapshot(
  history: CanvasHistoryStore,
  snapshot: PageCanvas,
  limit = 100,
) {
  history.undo = [
    ...history.undo.slice(-(limit - 1)),
    cloneCanvas(snapshot),
  ];
  history.redo = [];
}

export function takeCanvasUndo(
  history: CanvasHistoryStore,
  current: PageCanvas,
) {
  const previous = history.undo.pop();
  if (!previous) return null;
  history.redo.push(cloneCanvas(current));
  return previous;
}

export function takeCanvasRedo(
  history: CanvasHistoryStore,
  current: PageCanvas,
) {
  const next = history.redo.pop();
  if (!next) return null;
  history.undo.push(cloneCanvas(current));
  return next;
}

export function useCanvasHistory({
  canvas,
  setCanvas,
  onChange,
  limit = 100,
}: {
  canvas: PageCanvas;
  setCanvas: Dispatch<SetStateAction<PageCanvas>>;
  onChange: () => void;
  limit?: number;
}) {
  const history = useRef(createCanvasHistoryStore());
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: history.current.undo.length > 0,
      canRedo: history.current.redo.length > 0,
    });
  }, []);

  const commit = useCallback(
    (update: (draft: PageCanvas) => void) => {
      const draft = cloneCanvas(canvas);
      update(draft);
      if (!pageCanvasSchema.safeParse(draft).success) return;
      recordCanvasSnapshot(history.current, canvas, limit);
      syncHistoryState();
      setCanvas(draft);
      onChange();
    },
    [canvas, limit, onChange, setCanvas, syncHistoryState],
  );

  const recordSnapshot = useCallback(
    (snapshot: PageCanvas) => {
      recordCanvasSnapshot(history.current, snapshot, limit);
      syncHistoryState();
    },
    [limit, syncHistoryState],
  );

  const undo = useCallback(() => {
    const previous = takeCanvasUndo(history.current, canvas);
    if (!previous) return;
    setCanvas(previous);
    syncHistoryState();
    onChange();
  }, [canvas, onChange, setCanvas, syncHistoryState]);

  const redo = useCallback(() => {
    const next = takeCanvasRedo(history.current, canvas);
    if (!next) return;
    setCanvas(next);
    syncHistoryState();
    onChange();
  }, [canvas, onChange, setCanvas, syncHistoryState]);

  return { commit, recordSnapshot, undo, redo, ...historyState };
}
