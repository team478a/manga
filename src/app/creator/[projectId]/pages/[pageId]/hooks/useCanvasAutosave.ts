"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PageCanvas } from "@mangai/canvas-core";
import {
  CANVAS_SAVE_TIMEOUT_MS,
  canvasSaveRetryDelay,
  hasUnsavedCanvasChanges,
  shouldRetryCanvasSave,
} from "@/lib/canvas-autosave-policy";
import { saveCanvasSnapshot } from "../services/creator-api";
import {
  readApiErrorCode,
  readApiErrorMessage,
  type CompatibleApiErrorEnvelope,
} from "@/lib/api-error-contract";

export type CanvasSaveState =
  | "saved"
  | "dirty"
  | "saving"
  | "conflict"
  | "error";

function cloneCanvas(canvas: PageCanvas) {
  return structuredClone(canvas);
}

export function useCanvasAutosave({
  pageId,
  initialRevision,
  canvas,
  setMessage,
}: {
  pageId: string;
  initialRevision: number;
  canvas: PageCanvas;
  setMessage: (message: string) => void;
}) {
  const [saveState, setSaveState] = useState<CanvasSaveState>("saved");
  const revision = useRef(initialRevision);
  const canvasRef = useRef(canvas);
  const saveStateRef = useRef<CanvasSaveState>("saved");
  const changeVersion = useRef(0);
  const saving = useRef(false);
  const queuedSave = useRef(false);
  const retryAttempt = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const activeSaveController = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const updateSaveState = useCallback((state: CanvasSaveState) => {
    saveStateRef.current = state;
    setSaveState(state);
  }, []);

  const markDirty = useCallback(() => {
    changeVersion.current += 1;
    updateSaveState("dirty");
  }, [updateSaveState]);

  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeSaveController.current?.abort();
      if (retryTimer.current !== null)
        window.clearTimeout(retryTimer.current);
    };
  }, []);

  const save = useCallback(async () => {
    if (saving.current) {
      queuedSave.current = true;
      return;
    }
    if (saveStateRef.current === "conflict") return;
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }

    saving.current = true;
    queuedSave.current = false;
    const savingVersion = changeVersion.current;
    const savingCanvas = cloneCanvas(canvasRef.current);
    updateSaveState("saving");
    const controller = new AbortController();
    activeSaveController.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CANVAS_SAVE_TIMEOUT_MS);
    const scheduleRetry = (reason: string) => {
      if (!mounted.current) return;
      retryAttempt.current += 1;
      const delay = canvasSaveRetryDelay(retryAttempt.current);
      updateSaveState("error");
      setMessage(
        `${reason} ${Math.ceil(delay / 1000)}秒後に自動再試行します。`,
      );
      retryTimer.current = window.setTimeout(() => {
        retryTimer.current = null;
        if (mounted.current && saveStateRef.current !== "conflict") {
          updateSaveState("dirty");
        }
      }, delay);
    };

    try {
      const response = await saveCanvasSnapshot(
        pageId,
        revision.current,
        savingCanvas,
        controller.signal,
      );
      const responseText = await response.text();
      let result: { revision?: number } & CompatibleApiErrorEnvelope;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        if (response.status === 409) {
          retryAttempt.current = 0;
          updateSaveState("conflict");
          setMessage(
            "別の編集と競合しました。最新状態を再読込してください。",
          );
        } else if (shouldRetryCanvasSave(response.status)) {
          scheduleRetry("保存応答を読み取れませんでした。");
        } else {
          updateSaveState("error");
          setMessage("保存応答を読み取れませんでした。");
        }
        return;
      }
      if (
        readApiErrorCode(result) === "REVISION_CONFLICT" ||
        response.status === 409
      ) {
        retryAttempt.current = 0;
        updateSaveState("conflict");
        setMessage(
          readApiErrorMessage(
            result,
            "別の編集と競合しました。最新状態を再読込してください。",
          ),
        );
        return;
      }
      if (!response.ok || typeof result.revision !== "number") {
        const reason = readApiErrorMessage(result, "保存できませんでした。");
        if (shouldRetryCanvasSave(response.status)) scheduleRetry(reason);
        else {
          updateSaveState("error");
          setMessage(reason);
        }
        return;
      }
      revision.current = result.revision;
      retryAttempt.current = 0;
      setMessage("");
      if (changeVersion.current === savingVersion && !queuedSave.current) {
        updateSaveState("saved");
      } else {
        updateSaveState("saving");
        window.setTimeout(() => updateSaveState("dirty"), 0);
      }
    } catch (error) {
      if (!mounted.current) return;
      scheduleRetry(
        timedOut
          ? "保存がタイムアウトしました。"
          : error instanceof Error && error.name !== "AbortError"
            ? `保存通信に失敗しました: ${error.message}`
            : "保存通信に失敗しました。",
      );
    } finally {
      window.clearTimeout(timeout);
      if (activeSaveController.current === controller)
        activeSaveController.current = null;
      saving.current = false;
    }
  }, [pageId, setMessage, updateSaveState]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timer);
  }, [save, saveState]);

  useEffect(() => {
    const onOnline = () => {
      if (
        hasUnsavedCanvasChanges(saveStateRef.current) &&
        saveStateRef.current !== "conflict"
      ) {
        if (retryTimer.current !== null) {
          window.clearTimeout(retryTimer.current);
          retryTimer.current = null;
        }
        updateSaveState("dirty");
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [updateSaveState]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedCanvasChanges(saveStateRef.current)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const hasUnsavedChanges = useCallback(
    () => hasUnsavedCanvasChanges(saveStateRef.current),
    [],
  );

  return {
    saveState,
    save,
    markDirty,
    updateSaveState,
    hasUnsavedChanges,
  };
}
