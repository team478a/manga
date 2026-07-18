"use client";
/* eslint-disable @next/next/no-img-element -- Canvas uses private signed URLs and raw image dimensions. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Circle,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  PanelTop,
  Redo2,
  Save,
  Trash2,
  Type,
  Undo2,
  Unlock,
} from "lucide-react";
import {
  constrainRectToPage,
  pageCanvasSchema,
  type Balloon,
  type PageCanvas,
  type Panel,
  type PanelLayer,
  type TextObject,
} from "@mangai/canvas-core";
import type {
  CloudAsset,
  CloudPage,
  CloudProjectSummary,
} from "@/lib/cloud-creator-server";

type Selection = { type: "panel" | "balloon" | "text"; id: string } | null;
type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";
type CanvasItem = Panel | Balloon | TextObject;

function cloneCanvas(canvas: PageCanvas): PageCanvas {
  return structuredClone(canvas);
}

function now() {
  return new Date().toISOString();
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

async function asDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Assetを読み込めませんでした。");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Assetを変換できませんでした。"));
    reader.readAsDataURL(blob);
  });
}

function svgMarkup(canvas: PageCanvas, assets: Map<string, string>) {
  const layersByPanel = new Map<string, PanelLayer[]>();
  for (const layer of canvas.panelLayers) {
    const list = layersByPanel.get(layer.panelId) ?? [];
    list.push(layer);
    layersByPanel.set(layer.panelId, list);
  }
  const elements: string[] = [];
  for (const panel of canvas.panels.filter((item) => item.visible)) {
    const layers = (layersByPanel.get(panel.id) ?? [])
      .filter((layer) => layer.visible && layer.assetId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const assetId = layers.at(-1)?.assetId ?? panel.imageAssetId;
    const href = assetId ? assets.get(assetId) : null;
    elements.push(
      `<g transform="translate(${panel.x} ${panel.y}) rotate(${panel.rotation} ${panel.width / 2} ${panel.height / 2})">` +
        `<rect width="${panel.width}" height="${panel.height}" fill="${escapeXml(panel.fillColor)}" stroke="${escapeXml(panel.borderColor)}" stroke-width="${panel.borderWidth}"/>` +
        (href
          ? `<image href="${href}" width="${panel.width}" height="${panel.height}" preserveAspectRatio="xMidYMid slice" opacity="${layers.at(-1)?.opacity ?? panel.imageOpacity}"/>`
          : "") +
        `</g>`,
    );
  }
  for (const balloon of canvas.balloons.filter((item) => item.visible)) {
    const transform = `translate(${balloon.x} ${balloon.y}) rotate(${balloon.rotation} ${balloon.width / 2} ${balloon.height / 2})`;
    elements.push(
      balloon.type === "speech_ellipse"
        ? `<ellipse transform="${transform}" cx="${balloon.width / 2}" cy="${balloon.height / 2}" rx="${balloon.width / 2}" ry="${balloon.height / 2}" fill="${balloon.fillColor}" stroke="${balloon.strokeColor}" stroke-width="${balloon.strokeWidth}" opacity="${balloon.opacity}"/>`
        : `<rect transform="${transform}" width="${balloon.width}" height="${balloon.height}" rx="${balloon.type === "speech_rounded" ? 32 : 0}" fill="${balloon.fillColor}" stroke="${balloon.strokeColor}" stroke-width="${balloon.strokeWidth}" opacity="${balloon.opacity}"/>`,
    );
  }
  for (const text of canvas.textObjects.filter((item) => item.visible)) {
    const writingMode =
      text.writingMode === "vertical" ? "vertical-rl" : "horizontal-tb";
    elements.push(
      `<foreignObject x="${text.x}" y="${text.y}" width="${text.width}" height="${text.height}" transform="rotate(${text.rotation} ${text.x + text.width / 2} ${text.y + text.height / 2})" opacity="${text.opacity}"><div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:100%;height:100%;padding:${text.padding}px;color:${text.color};font-family:${escapeXml(text.fontFamily)};font-size:${text.fontSize}px;font-weight:${text.fontWeight};line-height:${text.lineHeight};letter-spacing:${text.letterSpacing}px;writing-mode:${writingMode};white-space:pre-wrap;overflow:hidden">${escapeXml(text.text)}</div></foreignObject>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><rect width="100%" height="100%" fill="${canvas.backgroundColor}"/>${elements.join("")}</svg>`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CloudCanvasEditor({
  project,
  pages,
  page,
  initialCanvas,
  initialAssets,
}: {
  project: CloudProjectSummary;
  pages: CloudPage[];
  page: CloudPage;
  initialCanvas: PageCanvas;
  initialAssets: CloudAsset[];
}) {
  const [canvas, setCanvas] = useState(() => cloneCanvas(initialCanvas));
  const [assets, setAssets] = useState(initialAssets);
  const [selection, setSelection] = useState<Selection>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const revision = useRef(page.revision);
  const canvasRef = useRef(canvas);
  const changeVersion = useRef(0);
  const saving = useRef(false);
  const queuedSave = useRef(false);
  const undoStack = useRef<PageCanvas[]>([]);
  const redoStack = useRef<PageCanvas[]>([]);
  const canvasElement = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    selection: Exclude<Selection, null>;
    startX: number;
    startY: number;
    objectX: number;
    objectY: number;
    before: PageCanvas;
  } | null>(null);

  const assetMap = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets],
  );
  const previewUrl = useMemo(
    () =>
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        svgMarkup(
          canvas,
          new Map(assets.map((asset) => [asset.id, asset.url])),
        ),
      )}`,
    [assets, canvas],
  );
  const items = useMemo(
    () =>
      [
        ...canvas.panels.map((item) => ({ type: "panel" as const, item })),
        ...canvas.balloons.map((item) => ({ type: "balloon" as const, item })),
        ...canvas.textObjects.map((item) => ({ type: "text" as const, item })),
      ].sort((a, b) => b.item.zIndex - a.item.zIndex),
    [canvas],
  );
  const selected = selection
    ? (items.find(
        (entry) =>
          entry.type === selection.type && entry.item.id === selection.id,
      )?.item ?? null)
    : null;
  const nextZIndex = useMemo(
    () => Math.max(-1, ...items.map((entry) => entry.item.zIndex)) + 1,
    [items],
  );

  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);

  const commit = useCallback((update: (draft: PageCanvas) => void) => {
    changeVersion.current += 1;
    setCanvas((current) => {
      const draft = cloneCanvas(current);
      update(draft);
      if (!pageCanvasSchema.safeParse(draft).success) return current;
      undoStack.current = [
        ...undoStack.current.slice(-99),
        cloneCanvas(current),
      ];
      redoStack.current = [];
      return draft;
    });
    setSaveState("dirty");
  }, []);

  const save = useCallback(async () => {
    if (saving.current) {
      queuedSave.current = true;
      return;
    }
    saving.current = true;
    queuedSave.current = false;
    const savingVersion = changeVersion.current;
    const savingCanvas = cloneCanvas(canvasRef.current);
    setSaveState("saving");
    try {
      const response = await fetch(`/api/creator/pages/${page.id}/snapshot`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedRevision: revision.current,
          canvas: savingCanvas,
        }),
      });
      const result = (await response.json()) as {
        revision?: number;
        error?: string;
      };
      if (response.status === 409) {
        setSaveState("conflict");
        setMessage(
          result.error ?? "別の編集と競合しました。再読込してください。",
        );
        return;
      }
      if (!response.ok || typeof result.revision !== "number") {
        setSaveState("error");
        setMessage(result.error ?? "保存できませんでした。");
        return;
      }
      revision.current = result.revision;
      setMessage("");
      if (changeVersion.current === savingVersion && !queuedSave.current) {
        setSaveState("saved");
      } else {
        setSaveState("saving");
        window.setTimeout(() => setSaveState("dirty"), 0);
      }
    } finally {
      saving.current = false;
    }
  }, [page.id]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timer);
  }, [save, saveState]);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(cloneCanvas(canvas));
    changeVersion.current += 1;
    setCanvas(previous);
    setSaveState("dirty");
  }, [canvas]);
  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(cloneCanvas(canvas));
    changeVersion.current += 1;
    setCanvas(next);
    setSaveState("dirty");
  }, [canvas]);

  const deleteSelected = useCallback(() => {
    if (!selection) return;
    commit((draft) => {
      if (selection.type === "panel") {
        draft.panels = draft.panels.filter((item) => item.id !== selection.id);
        draft.panelLayers = draft.panelLayers.filter(
          (layer) => layer.panelId !== selection.id,
        );
      } else if (selection.type === "balloon") {
        draft.balloons = draft.balloons.filter(
          (item) => item.id !== selection.id,
        );
        draft.textObjects = draft.textObjects.map((text) =>
          text.parentBalloonId === selection.id
            ? { ...text, parentBalloonId: null }
            : text,
        );
      } else {
        draft.textObjects = draft.textObjects.filter(
          (item) => item.id !== selection.id,
        );
      }
    });
    setSelection(null);
  }, [commit, selection]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        redo();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, redo, undo]);

  function addPanel() {
    const id = crypto.randomUUID();
    const timestamp = now();
    commit((draft) => {
      draft.panels.push({
        id,
        pageId: page.id,
        name: `コマ${draft.panels.length + 1}`,
        x: canvas.width * 0.1,
        y: canvas.height * 0.1,
        width: canvas.width * 0.8,
        height: canvas.height * 0.35,
        rotation: 0,
        zIndex: nextZIndex,
        visible: true,
        locked: false,
        borderColor: "#111111",
        borderWidth: 8,
        fillColor: "#ffffff",
        shape: "rectangle",
        slant: 0.12,
        imageAssetId: null,
        imageFit: "cover",
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageRotation: 0,
        imageOpacity: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
    setSelection({ type: "panel", id });
  }

  function addBalloon() {
    const id = crypto.randomUUID();
    const timestamp = now();
    commit((draft) => {
      draft.balloons.push({
        id,
        pageId: page.id,
        name: `吹き出し${draft.balloons.length + 1}`,
        type: "speech_ellipse",
        x: canvas.width * 0.55,
        y: canvas.height * 0.12,
        width: canvas.width * 0.32,
        height: canvas.height * 0.2,
        rotation: 0,
        zIndex: nextZIndex,
        visible: true,
        locked: false,
        fillColor: "#ffffff",
        strokeColor: "#111111",
        strokeWidth: 6,
        opacity: 1,
        tailDirection: "bottom_left",
        tailOffset: 0.5,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
    setSelection({ type: "balloon", id });
  }

  function addText() {
    const id = crypto.randomUUID();
    const timestamp = now();
    commit((draft) => {
      draft.textObjects.push({
        id,
        pageId: page.id,
        parentBalloonId: null,
        name: `テキスト${draft.textObjects.length + 1}`,
        text: "テキスト",
        writingMode: "vertical",
        x: canvas.width * 0.65,
        y: canvas.height * 0.15,
        width: canvas.width * 0.16,
        height: canvas.height * 0.3,
        rotation: 0,
        zIndex: nextZIndex,
        visible: true,
        locked: false,
        fontFamily: "sans-serif",
        fontSize: 64,
        fontWeight: 400,
        color: "#111111",
        textAlign: "start",
        verticalAlign: "top",
        lineHeight: 1.5,
        letterSpacing: 0,
        padding: 16,
        opacity: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
    setSelection({ type: "text", id });
  }

  function mutateSelected(update: (item: CanvasItem) => void) {
    if (!selection) return;
    commit((draft) => {
      const collection =
        selection.type === "panel"
          ? draft.panels
          : selection.type === "balloon"
            ? draft.balloons
            : draft.textObjects;
      const item = collection.find(
        (candidate) => candidate.id === selection.id,
      );
      if (item) update(item);
    });
  }

  function pointerDown(
    event: React.PointerEvent<HTMLElement>,
    nextSelection: Exclude<Selection, null>,
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

  function pointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!drag.current || !canvasElement.current) return;
    const scale = canvasElement.current.clientWidth / canvas.width;
    const x =
      drag.current.objectX + (event.clientX - drag.current.startX) / scale;
    const y =
      drag.current.objectY + (event.clientY - drag.current.startY) / scale;
    const active = drag.current.selection;
    changeVersion.current += 1;
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
    setSaveState("dirty");
  }

  function pointerUp(event: React.PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    undoStack.current = [...undoStack.current.slice(-99), drag.current.before];
    redoStack.current = [];
    drag.current = null;
  }

  async function uploadAsset(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("Assetをアップロードしています…");
    const formData = new FormData();
    formData.set("projectId", project.id);
    formData.set("file", file);
    const response = await fetch("/api/creator/assets", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as CloudAsset & { error?: string };
    if (!response.ok) {
      setMessage(result.error ?? "Assetを追加できませんでした。");
      return;
    }
    const signed = await fetch(`/api/creator/assets?id=${result.id}`);
    const signedResult = (await signed.json()) as {
      url?: string;
      error?: string;
    };
    if (!signed.ok || !signedResult.url) {
      setMessage(signedResult.error ?? "Assetを表示できませんでした。");
      return;
    }
    setAssets((current) => [{ ...result, url: signedResult.url! }, ...current]);
    setMessage("Assetを追加しました。");
    event.target.value = "";
  }

  function applyAsset(assetId: string) {
    if (selection?.type !== "panel") return;
    const layerId = crypto.randomUUID();
    const timestamp = now();
    commit((draft) => {
      const panel = draft.panels.find((item) => item.id === selection.id);
      if (!panel) return;
      panel.imageAssetId = assetId;
      const currentLayers = draft.panelLayers.filter(
        (layer) => layer.panelId === panel.id,
      );
      draft.panelLayers.push({
        id: layerId,
        panelId: panel.id,
        name: assetMap.get(assetId)?.file_name ?? "画像レイヤー",
        type: "background",
        orderIndex: currentLayers.length,
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        assetId,
        sourceJobId: null,
        imageFit: "cover",
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageRotation: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  }

  function movePanelLayer(layerId: string, delta: -1 | 1) {
    commit((draft) => {
      const target = draft.panelLayers.find((layer) => layer.id === layerId);
      if (!target) return;
      const siblings = draft.panelLayers
        .filter((layer) => layer.panelId === target.panelId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const index = siblings.findIndex((layer) => layer.id === layerId);
      const other = siblings[index + delta];
      if (!other) return;
      const orderIndex = target.orderIndex;
      target.orderIndex = other.orderIndex;
      other.orderIndex = orderIndex;
    });
  }

  function moveSelected(delta: -1 | 1) {
    if (!selection) return;
    commit((draft) => {
      const ordered = [
        ...draft.panels.map((item) => ({ type: "panel" as const, item })),
        ...draft.balloons.map((item) => ({ type: "balloon" as const, item })),
        ...draft.textObjects.map((item) => ({ type: "text" as const, item })),
      ].sort((a, b) => a.item.zIndex - b.item.zIndex);
      const index = ordered.findIndex(
        (entry) =>
          entry.type === selection.type && entry.item.id === selection.id,
      );
      const other = ordered[index + delta];
      if (index < 0 || !other) return;
      const zIndex = ordered[index].item.zIndex;
      ordered[index].item.zIndex = other.item.zIndex;
      other.item.zIndex = zIndex;
    });
  }

  async function exportPng() {
    setMessage("PNGを書き出しています…");
    try {
      const dataUrls = new Map<string, string>();
      await Promise.all(
        assets.map(async (asset) =>
          dataUrls.set(asset.id, await asDataUrl(asset.url)),
        ),
      );
      const svg = svgMarkup(canvas, dataUrls);
      const image = new Image();
      const svgUrl = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml" }),
      );
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(new Error("Previewを描画できませんでした。"));
        image.src = svgUrl;
      });
      const output = document.createElement("canvas");
      output.width = canvas.width;
      output.height = canvas.height;
      output.getContext("2d")?.drawImage(image, 0, 0);
      URL.revokeObjectURL(svgUrl);
      const blob = await new Promise<Blob | null>((resolve) =>
        output.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("PNGを作成できませんでした。");
      downloadBlob(
        blob,
        `${project.title}-${String(page.page_number).padStart(3, "0")}.png`,
      );
      setMessage("PNGを書き出しました。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "書き出しに失敗しました。",
      );
    }
  }

  const selectedPanelLayers =
    selection?.type === "panel"
      ? canvas.panelLayers
          .filter((layer) => layer.panelId === selection.id)
          .sort((a, b) => b.orderIndex - a.orderIndex)
      : [];

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="sticky top-0 z-30 border-b border-stone-300 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2">
          <Link className="button-secondary" href={`/creator/${project.id}`}>
            ← 構成
          </Link>
          <strong className="mr-auto">
            {project.title} / {page.page_number}ページ
          </strong>
          <button
            className="button-secondary"
            onClick={undo}
            disabled={!undoStack.current.length}
            type="button"
          >
            <Undo2 className="mr-1 h-4 w-4" />
            戻す
          </button>
          <button
            className="button-secondary"
            onClick={redo}
            disabled={!redoStack.current.length}
            type="button"
          >
            <Redo2 className="mr-1 h-4 w-4" />
            やり直す
          </button>
          <button
            className="button-secondary"
            onClick={() => setPreview(true)}
            type="button"
          >
            <Eye className="mr-1 h-4 w-4" />
            Preview
          </button>
          <button
            className="button-secondary"
            onClick={() => void exportPng()}
            type="button"
          >
            <Download className="mr-1 h-4 w-4" />
            PNG
          </button>
          <details className="relative">
            <summary className="button-secondary cursor-pointer list-none">
              作品を書き出す
            </summary>
            <div className="absolute right-0 z-40 mt-2 grid w-60 gap-2 rounded-lg border border-stone-200 bg-white p-3 shadow-xl">
              <a
                className="button-secondary"
                href={`/api/creator/projects/${project.id}/export?format=pdf`}
              >
                本編PDF
              </a>
              <a
                className="button-secondary"
                href={`/api/creator/projects/${project.id}/export?format=images`}
              >
                連番画像ZIP
              </a>
              <a
                className="button-secondary"
                href={`/api/creator/projects/${project.id}/export?format=package`}
              >
                販売パッケージ
              </a>
            </div>
          </details>
          <button
            className="button"
            onClick={() => void save()}
            disabled={saveState === "saving" || saveState === "saved"}
            type="button"
          >
            <Save className="mr-1 h-4 w-4" />
            {saveState === "saving"
              ? "保存中"
              : saveState === "saved"
                ? "保存済み"
                : "保存"}
          </button>
        </div>
      </header>
      {saveState === "conflict" || saveState === "error" ? (
        <p className="mx-auto max-w-[1600px] bg-red-50 p-3 text-red-800">
          {message}
        </p>
      ) : message ? (
        <p className="mx-auto max-w-[1600px] bg-blue-50 p-3 text-blue-900">
          {message}
        </p>
      ) : null}
      <div className="mx-auto grid max-w-[1600px] gap-4 p-4 xl:grid-cols-[220px_minmax(480px,1fr)_320px]">
        <aside className="space-y-4">
          <section className="panel p-4">
            <h2 className="font-bold">Page</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-2">
              {pages.map((entry) => (
                <Link
                  aria-current={entry.id === page.id ? "page" : undefined}
                  className={`rounded-md border p-2 text-center ${entry.id === page.id ? "border-leaf bg-green-50 font-bold" : "border-stone-200 bg-white"}`}
                  href={`/creator/${project.id}/pages/${entry.id}`}
                  key={entry.id}
                >
                  {entry.page_number}
                </Link>
              ))}
            </div>
          </section>
          <section className="panel p-4">
            <h2 className="font-bold">追加</h2>
            <div className="mt-3 grid gap-2">
              <button
                className="button-secondary"
                onClick={addPanel}
                type="button"
              >
                <PanelTop className="mr-2 h-5 w-5" />
                コマ
              </button>
              <button
                className="button-secondary"
                onClick={addBalloon}
                type="button"
              >
                <Circle className="mr-2 h-5 w-5" />
                吹き出し
              </button>
              <button
                className="button-secondary"
                onClick={addText}
                type="button"
              >
                <Type className="mr-2 h-5 w-5" />
                テキスト
              </button>
            </div>
          </section>
          <section className="panel p-4">
            <h2 className="font-bold">Asset Library</h2>
            <label className="button-secondary mt-3 w-full cursor-pointer">
              <ImagePlus className="mr-2 h-5 w-5" />
              画像を追加
              <input
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void uploadAsset(event)}
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {assets.map((asset) => (
                <button
                  className="overflow-hidden rounded border border-stone-200 bg-white text-left"
                  key={asset.id}
                  onClick={() => applyAsset(asset.id)}
                  title="選択中のコマへ配置"
                  type="button"
                >
                  <img
                    alt=""
                    className="aspect-square w-full object-cover"
                    src={asset.url}
                  />
                  <span className="block truncate p-1 text-xs">
                    {asset.file_name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
        <main className="flex items-start justify-center overflow-auto rounded-lg bg-stone-300 p-4 sm:p-8">
          <div
            ref={canvasElement}
            aria-label={`${page.page_number}ページ Canvas`}
            className="relative w-full max-w-[720px] overflow-hidden bg-white shadow-2xl"
            onPointerDown={() => setSelection(null)}
            role="application"
            style={{
              aspectRatio: `${canvas.width} / ${canvas.height}`,
              backgroundColor: canvas.backgroundColor,
            }}
          >
            {canvas.panels
              .filter((item) => item.visible)
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((panel) => {
                const panelLayers = canvas.panelLayers
                  .filter(
                    (layer) =>
                      layer.panelId === panel.id &&
                      layer.visible &&
                      layer.assetId,
                  )
                  .sort((a, b) => a.orderIndex - b.orderIndex);
                const topLayer = panelLayers.at(-1);
                const asset = assetMap.get(
                  topLayer?.assetId ?? panel.imageAssetId ?? "",
                );
                return (
                  <div
                    className={`absolute overflow-hidden ${selection?.type === "panel" && selection.id === panel.id ? "ring-4 ring-blue-500" : ""}`}
                    key={panel.id}
                    onPointerDown={(event) =>
                      pointerDown(event, { type: "panel", id: panel.id }, panel)
                    }
                    onPointerMove={pointerMove}
                    onPointerUp={pointerUp}
                    style={{
                      left: `${(panel.x / canvas.width) * 100}%`,
                      top: `${(panel.y / canvas.height) * 100}%`,
                      width: `${(panel.width / canvas.width) * 100}%`,
                      height: `${(panel.height / canvas.height) * 100}%`,
                      zIndex: panel.zIndex,
                      transform: `rotate(${panel.rotation}deg)`,
                      background: panel.fillColor,
                      border: `${Math.max(1, (panel.borderWidth * canvasElement.current?.clientWidth!) / canvas.width || 1)}px solid ${panel.borderColor}`,
                      touchAction: "none",
                    }}
                  >
                    {asset ? (
                      <img
                        alt=""
                        draggable={false}
                        className="h-full w-full object-cover"
                        src={asset.url}
                        style={{
                          opacity: topLayer?.opacity ?? panel.imageOpacity,
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            {canvas.balloons
              .filter((item) => item.visible)
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((balloon) => (
                <div
                  className={`absolute ${selection?.type === "balloon" && selection.id === balloon.id ? "ring-4 ring-blue-500" : ""}`}
                  key={balloon.id}
                  onPointerDown={(event) =>
                    pointerDown(
                      event,
                      { type: "balloon", id: balloon.id },
                      balloon,
                    )
                  }
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  style={{
                    left: `${(balloon.x / canvas.width) * 100}%`,
                    top: `${(balloon.y / canvas.height) * 100}%`,
                    width: `${(balloon.width / canvas.width) * 100}%`,
                    height: `${(balloon.height / canvas.height) * 100}%`,
                    zIndex: balloon.zIndex,
                    transform: `rotate(${balloon.rotation}deg)`,
                    borderRadius:
                      balloon.type === "speech_ellipse"
                        ? "50%"
                        : balloon.type === "speech_rounded"
                          ? "1.5rem"
                          : 0,
                    background: balloon.fillColor,
                    border: `2px solid ${balloon.strokeColor}`,
                    opacity: balloon.opacity,
                    touchAction: "none",
                  }}
                />
              ))}
            {canvas.textObjects
              .filter((item) => item.visible)
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((text) => (
                <div
                  className={`absolute overflow-hidden whitespace-pre-wrap ${selection?.type === "text" && selection.id === text.id ? "ring-4 ring-blue-500" : ""}`}
                  key={text.id}
                  onPointerDown={(event) =>
                    pointerDown(event, { type: "text", id: text.id }, text)
                  }
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  style={{
                    left: `${(text.x / canvas.width) * 100}%`,
                    top: `${(text.y / canvas.height) * 100}%`,
                    width: `${(text.width / canvas.width) * 100}%`,
                    height: `${(text.height / canvas.height) * 100}%`,
                    zIndex: text.zIndex,
                    transform: `rotate(${text.rotation}deg)`,
                    writingMode:
                      text.writingMode === "vertical"
                        ? "vertical-rl"
                        : "horizontal-tb",
                    fontFamily: text.fontFamily,
                    fontSize: `${(text.fontSize / canvas.width) * 100}cqw`,
                    fontWeight: text.fontWeight,
                    color: text.color,
                    lineHeight: text.lineHeight,
                    letterSpacing: `${text.letterSpacing}px`,
                    padding: `${(text.padding / canvas.width) * 100}%`,
                    opacity: text.opacity,
                    touchAction: "none",
                    containerType: "inline-size",
                  }}
                >
                  {text.text}
                </div>
              ))}
          </div>
        </main>
        <aside className="space-y-4">
          <section className="panel p-4">
            <h2 className="font-bold">レイヤー</h2>
            <div className="mt-3 space-y-2">
              {items.map(({ type, item }) => (
                <button
                  className={`flex w-full items-center gap-2 rounded border p-2 text-left ${selection?.type === type && selection.id === item.id ? "border-leaf bg-green-50" : "border-stone-200"}`}
                  key={`${type}-${item.id}`}
                  onClick={() => setSelection({ type, id: item.id })}
                  type="button"
                >
                  {item.visible ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.locked ? <Lock className="h-4 w-4" /> : null}
                </button>
              ))}
            </div>
          </section>
          <section className="panel p-4">
            <h2 className="font-bold">プロパティ</h2>
            {selected ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="label" htmlFor="object-name">
                    名前
                  </label>
                  <input
                    className="field"
                    id="object-name"
                    value={selected.name}
                    onChange={(event) =>
                      mutateSelected((item) => {
                        item.name = event.target.value || "名称未設定";
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["x", "y", "width", "height", "rotation"] as const).map(
                    (key) => (
                      <label className="text-sm" key={key}>
                        {key}
                        <input
                          className="field mt-1 px-2 py-2"
                          type="number"
                          value={Math.round(selected[key])}
                          onChange={(event) =>
                            mutateSelected((item) => {
                              const numeric = Number(event.target.value);
                              if (Number.isFinite(numeric))
                                (item[key] as number) =
                                  key === "width" || key === "height"
                                    ? Math.max(16, numeric)
                                    : numeric;
                            })
                          }
                        />
                      </label>
                    ),
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="button-secondary flex-1"
                    onClick={() => moveSelected(1)}
                    type="button"
                  >
                    <ArrowUp className="mr-1 h-4 w-4" />
                    前面へ
                  </button>
                  <button
                    className="button-secondary flex-1"
                    onClick={() => moveSelected(-1)}
                    type="button"
                  >
                    <ArrowDown className="mr-1 h-4 w-4" />
                    背面へ
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    className="button-secondary flex-1"
                    onClick={() =>
                      mutateSelected((item) => {
                        item.visible = !item.visible;
                      })
                    }
                    type="button"
                  >
                    {selected.visible ? (
                      <EyeOff className="mr-1 h-4 w-4" />
                    ) : (
                      <Eye className="mr-1 h-4 w-4" />
                    )}
                    {selected.visible ? "非表示" : "表示"}
                  </button>
                  <button
                    className="button-secondary flex-1"
                    onClick={() =>
                      mutateSelected((item) => {
                        item.locked = !item.locked;
                      })
                    }
                    type="button"
                  >
                    {selected.locked ? (
                      <Unlock className="mr-1 h-4 w-4" />
                    ) : (
                      <Lock className="mr-1 h-4 w-4" />
                    )}
                    {selected.locked ? "解除" : "固定"}
                  </button>
                </div>
                {selection?.type === "text" ? (
                  <>
                    <div>
                      <label className="label" htmlFor="text-body">
                        本文
                      </label>
                      <textarea
                        className="field min-h-28"
                        id="text-body"
                        value={(selected as TextObject).text}
                        onChange={(event) =>
                          mutateSelected((item) => {
                            (item as TextObject).text = event.target.value;
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label>
                        書字方向
                        <select
                          className="field"
                          value={(selected as TextObject).writingMode}
                          onChange={(event) =>
                            mutateSelected((item) => {
                              (item as TextObject).writingMode = event.target
                                .value as "vertical" | "horizontal";
                            })
                          }
                        >
                          <option value="vertical">縦書き</option>
                          <option value="horizontal">横書き</option>
                        </select>
                      </label>
                      <label>
                        文字サイズ
                        <input
                          className="field"
                          type="number"
                          min="1"
                          max="2000"
                          value={(selected as TextObject).fontSize}
                          onChange={(event) =>
                            mutateSelected((item) => {
                              (item as TextObject).fontSize = Math.max(
                                1,
                                Number(event.target.value),
                              );
                            })
                          }
                        />
                      </label>
                    </div>
                  </>
                ) : null}
                {selection?.type === "panel" && selectedPanelLayers.length ? (
                  <div>
                    <h3 className="font-semibold">コマ内レイヤー</h3>
                    <div className="mt-2 space-y-2">
                      {selectedPanelLayers.map((layer) => (
                        <div
                          className="flex items-center gap-2 rounded border p-2"
                          key={layer.id}
                        >
                          <button
                            aria-label="表示切替"
                            onClick={() =>
                              commit((draft) => {
                                const target = draft.panelLayers.find(
                                  (item) => item.id === layer.id,
                                );
                                if (target) target.visible = !target.visible;
                              })
                            }
                            type="button"
                          >
                            {layer.visible ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {layer.name}
                          </span>
                          <button
                            aria-label="上へ"
                            onClick={() => movePanelLayer(layer.id, 1)}
                            type="button"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            aria-label="下へ"
                            onClick={() => movePanelLayer(layer.id, -1)}
                            type="button"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <button
                  className="flex min-h-11 w-full items-center justify-center rounded-md bg-red-50 px-4 font-semibold text-red-700 hover:bg-red-100"
                  onClick={deleteSelected}
                  type="button"
                >
                  <Trash2 className="mr-2 h-5 w-5" />
                  削除
                </button>
              </div>
            ) : (
              <p className="mt-3 text-stone-600">
                Canvasまたはレイヤー一覧から要素を選択してください。
              </p>
            )}
          </section>
        </aside>
      </div>
      {preview ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          onClick={() => setPreview(false)}
        >
          <div
            className="max-h-full max-w-4xl overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="button mb-3"
              onClick={() => setPreview(false)}
              type="button"
            >
              Previewを閉じる
            </button>
            <img
              alt={`${project.title} ${page.page_number}ページのPreview`}
              className="mx-auto max-h-[80vh] max-w-[80vw] bg-white object-contain"
              src={previewUrl}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
