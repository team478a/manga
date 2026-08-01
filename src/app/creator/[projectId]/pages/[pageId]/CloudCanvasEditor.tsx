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
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Unlock,
} from "lucide-react";
import {
  type Balloon,
  type PageCanvas,
  type Panel,
  type PanelLayer,
  type TextObject,
} from "@mangai/canvas-core";
import type {
  CloudAsset,
  CloudAiQuota,
  CloudGenerationJob,
  CloudPage,
  CloudProjectSummary,
} from "@/lib/cloud-creator-server";
import { useCanvasAutosave } from "./hooks/useCanvasAutosave";
import { useCanvasHistory } from "./hooks/useCanvasHistory";
import {
  useCanvasPointer,
  type CanvasSelection,
} from "./hooks/useCanvasPointer";
import { downloadCanvasPng } from "./services/canvas-download";
import { createCanvasSvg } from "./services/canvas-svg";
import { PanelInpaintingDialog } from "./PanelInpaintingDialog";
import { PanelImageComparisonDialog } from "./PanelImageComparisonDialog";
import {
  cancelGeneration,
  createGenerationJob,
  createStoryboardPanelGenerationJob,
  creatorProjectExportUrl,
  getAiQuota,
  getAssetUrl,
  listGenerationJobs,
  listProjectAssets,
  uploadProjectAsset,
} from "./services/creator-api";

type CanvasItem = Panel | Balloon | TextObject;
type RevisionPreset =
  | "face"
  | "hands"
  | "expression"
  | "costume"
  | "background"
  | "polish";
type OutpaintingDirection = "left" | "right" | "top" | "bottom" | "all";
type ShotOverride =
  | "storyboard"
  | "close_up"
  | "medium"
  | "wide"
  | "full_body";
type CameraAngleOverride =
  | "storyboard"
  | "eye_level"
  | "high"
  | "low"
  | "over_shoulder"
  | "dynamic";
type SubjectPlacement =
  | "storyboard"
  | "center"
  | "left"
  | "right"
  | "two_shot"
  | "foreground_background";
type GazeDirection =
  | "storyboard"
  | "camera"
  | "left"
  | "right"
  | "partner"
  | "off_frame";

const revisionPresetLabels: Record<RevisionPreset, string> = {
  face: "顔の崩れを直す",
  hands: "手・指の崩れを直す",
  expression: "表情を整える",
  costume: "衣装を設定に合わせる",
  background: "背景を整える",
  polish: "全体を仕上げる",
};
const outpaintingDirectionLabels: Record<OutpaintingDirection, string> = {
  left: "左側を広げる",
  right: "右側を広げる",
  top: "上側を広げる",
  bottom: "下側を広げる",
  all: "全方向を広げる",
};
const shotOverrideLabels: Record<ShotOverride, string> = {
  storyboard: "ネームどおり",
  close_up: "顔・表情を大きく",
  medium: "上半身と動作",
  wide: "人物と背景を広く",
  full_body: "全身・ポーズ",
};
const cameraAngleOverrideLabels: Record<CameraAngleOverride, string> = {
  storyboard: "ネームどおり",
  eye_level: "目線の高さ",
  high: "上から見下ろす",
  low: "下から見上げる",
  over_shoulder: "肩越し",
  dynamic: "躍動的な角度",
};
const subjectPlacementLabels: Record<SubjectPlacement, string> = {
  storyboard: "ネームどおり",
  center: "主役を中央",
  left: "主役を左",
  right: "主役を右",
  two_shot: "二人を並べる",
  foreground_background: "手前と奥に分ける",
};
const gazeDirectionLabels: Record<GazeDirection, string> = {
  storyboard: "ネームどおり",
  camera: "カメラを見る",
  left: "画面左を見る",
  right: "画面右を見る",
  partner: "会話相手を見る",
  off_frame: "画面外を見る",
};

function cloneCanvas(canvas: PageCanvas): PageCanvas {
  return structuredClone(canvas);
}

function now() {
  return new Date().toISOString();
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function CloudCanvasEditor({
  project,
  pages,
  page,
  initialCanvas,
  initialAssets,
  initialGenerationJobs,
  initialQuota,
  storyboardPanelGenerationEnabled,
  panelInpaintingEnabled,
  panelOutpaintingEnabled,
}: {
  project: CloudProjectSummary;
  pages: CloudPage[];
  page: CloudPage;
  initialCanvas: PageCanvas;
  initialAssets: CloudAsset[];
  initialGenerationJobs: CloudGenerationJob[];
  initialQuota: CloudAiQuota | null;
  storyboardPanelGenerationEnabled: boolean;
  panelInpaintingEnabled: boolean;
  panelOutpaintingEnabled: boolean;
}) {
  const [canvas, setCanvas] = useState(() => cloneCanvas(initialCanvas));
  const [assets, setAssets] = useState(initialAssets);
  const [generationJobs, setGenerationJobs] = useState(initialGenerationJobs);
  const [generationTargets, setGenerationTargets] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      initialGenerationJobs
        .filter((job) => job.target_panel_id)
        .map((job) => [job.id, job.target_panel_id!]),
    ),
  );
  const [quota, setQuota] = useState(initialQuota);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [generationType, setGenerationType] = useState<
    "background" | "prop" | "effect" | "character_base"
  >("background");
  const [textGenerationPrompt, setTextGenerationPrompt] = useState("");
  const [textGenerationType, setTextGenerationType] = useState<
    "story" | "storyboard" | "speech_bubble"
  >("speech_bubble");
  const [selection, setSelection] = useState<CanvasSelection>(null);
  const [message, setMessage] = useState("");
  const [requestingPanelGeneration, setRequestingPanelGeneration] =
    useState(false);
  const [panelCandidateCount, setPanelCandidateCount] = useState(3);
  const [shotOverride, setShotOverride] =
    useState<ShotOverride>("storyboard");
  const [cameraAngleOverride, setCameraAngleOverride] =
    useState<CameraAngleOverride>("storyboard");
  const [subjectPlacement, setSubjectPlacement] =
    useState<SubjectPlacement>("storyboard");
  const [gazeDirection, setGazeDirection] =
    useState<GazeDirection>("storyboard");
  const [compositionInstruction, setCompositionInstruction] = useState("");
  const [revisionPreset, setRevisionPreset] =
    useState<RevisionPreset>("face");
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [inpaintingDialogOpen, setInpaintingDialogOpen] = useState(false);
  const [outpaintingDirection, setOutpaintingDirection] =
    useState<OutpaintingDirection>("all");
  const [comparisonJobId, setComparisonJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const canvasElement = useRef<HTMLDivElement>(null);
  const { saveState, save, markDirty, hasUnsavedChanges } = useCanvasAutosave({
      pageId: page.id,
      initialRevision: page.revision,
      canvas,
      setMessage,
    });
  const { commit, recordSnapshot, undo, redo, canUndo, canRedo } =
    useCanvasHistory({
      canvas,
      setCanvas,
      onChange: markDirty,
    });
  const { pointerDown, pointerMove, pointerUp } = useCanvasPointer({
    canvas,
    setCanvas,
    canvasElement,
    setSelection,
    markDirty,
    recordSnapshot,
  });

  const assetMap = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets],
  );
  const canvasSvgAssets = useMemo(
    () =>
      new Map(
        assets.map((asset) => [
          asset.id,
          {
            href: asset.url,
            width: asset.width,
            height: asset.height,
          },
        ]),
      ),
    [assets],
  );
  const previewUrl = useMemo(
    () => svgDataUrl(createCanvasSvg(canvas, canvasSvgAssets)),
    [canvas, canvasSvgAssets],
  );
  const panelPreviewUrls = useMemo(
    () =>
      new Map(
        canvas.panels.map((panel) => {
          const panelCanvas: PageCanvas = {
            schemaVersion: 1,
            pageId: canvas.pageId,
            width: panel.width,
            height: panel.height,
            backgroundColor: "transparent",
            panels: [{ ...panel, x: 0, y: 0, rotation: 0, zIndex: 0 }],
            panelLayers: canvas.panelLayers.filter(
              (layer) => layer.panelId === panel.id,
            ),
            balloons: [],
            textObjects: [],
          };
          return [
            panel.id,
            svgDataUrl(createCanvasSvg(panelCanvas, canvasSvgAssets)),
          ];
        }),
      ),
    [canvas, canvasSvgAssets],
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

  const refreshGenerationJobs = useCallback(async () => {
    setGenerationJobs(await listGenerationJobs(project.id));
  }, [project.id]);

  const refreshQuota = useCallback(async () => {
    setQuota(await getAiQuota());
  }, []);

  useEffect(() => {
    if (
      !generationJobs.some(
        (job) => job.status === "queued" || job.status === "running",
      )
    )
      return;
    const timer = window.setInterval(() => {
      void refreshGenerationJobs();
      void refreshQuota();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [generationJobs, refreshGenerationJobs, refreshQuota]);

  useEffect(() => {
    const hasUnloadedGeneratedAsset = generationJobs.some(
      (job) =>
        job.status === "completed" &&
        Boolean(job.output_asset_id) &&
        !assetMap.has(job.output_asset_id!),
    );
    if (!hasUnloadedGeneratedAsset) return;
    void listProjectAssets(project.id)
      .then(setAssets)
      .catch(() => undefined);
  }, [assetMap, generationJobs, project.id]);

  const remainingCredits = quota
    ? Math.max(
        0,
        quota.credits_limit - quota.credits_used - quota.credits_reserved,
      )
    : 0;

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

  async function uploadAsset(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("Assetをアップロードしています…");
    try {
      const result = await uploadProjectAsset(project.id, file);
      const signedResult = await getAssetUrl(result.id);
      setAssets((current) => [
        { ...result, url: signedResult.url },
        ...current,
      ]);
      setMessage("Assetを追加しました。");
      event.target.value = "";
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Assetを追加できませんでした。",
      );
    }
  }

  function applyAsset(
    assetId: string,
    sourceJobId: string | null = null,
    layerType: PanelLayer["type"] = "background",
    targetPanelId?: string,
  ) {
    const panelId =
      targetPanelId ?? (selection?.type === "panel" ? selection.id : null);
    if (!panelId) return;
    const layerId = crypto.randomUUID();
    const timestamp = now();
    commit((draft) => {
      const panel = draft.panels.find((item) => item.id === panelId);
      if (!panel) return;
      panel.imageAssetId = assetId;
      const currentLayers = draft.panelLayers.filter(
        (layer) => layer.panelId === panel.id,
      );
      draft.panelLayers.push({
        id: layerId,
        panelId: panel.id,
        name: assetMap.get(assetId)?.file_name ?? "画像レイヤー",
        type: layerType,
        orderIndex: currentLayers.length,
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        assetId,
        sourceJobId,
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

  async function requestCloudGeneration() {
    if (!generationPrompt.trim()) return;
    setMessage("AI画像生成を受け付けています…");
    try {
      await createGenerationJob({
        projectId: project.id,
        pageId: page.id,
        idempotencyKey: crypto.randomUUID(),
        generation: {
          kind: "image",
          jobType: generationType,
          prompt: generationPrompt,
          negativePrompt: "",
          width: Math.min(2048, page.width),
          height: Math.min(2048, page.height),
        },
      });
      setGenerationPrompt("");
      setMessage("AI画像生成を受け付けました。");
      await Promise.all([refreshGenerationJobs(), refreshQuota()]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "AI画像生成を受け付けられませんでした。",
      );
    }
  }

  async function requestStoryboardPanelGeneration(options?: {
    panelId?: string;
    candidateCount?: number;
    sourceAssetId?: string;
    maskAssetId?: string;
    outpaintingDirection?: OutpaintingDirection;
    revisionPreset?: RevisionPreset;
    revisionInstruction?: string;
    shotOverride?: ShotOverride;
    cameraAngleOverride?: CameraAngleOverride;
    subjectPlacement?: SubjectPlacement;
    gazeDirection?: GazeDirection;
    compositionInstruction?: string;
  }) {
    const panelId =
      options?.panelId ?? (selection?.type === "panel" ? selection.id : null);
    if (!panelId || requestingPanelGeneration) return;
    const candidateCount = options?.candidateCount ?? panelCandidateCount;
    setRequestingPanelGeneration(true);
    setMessage(`${candidateCount}案の画像生成を準備しています…`);
    try {
      const result = await createStoryboardPanelGenerationJob({
        projectId: project.id,
        pageId: page.id,
        panelId,
        idempotencyKey: crypto.randomUUID(),
        candidateCount,
        sourceAssetId: options?.sourceAssetId,
        maskAssetId: options?.maskAssetId,
        outpaintingDirection: options?.outpaintingDirection,
        revisionPreset: options?.revisionPreset,
        revisionInstruction: options?.revisionInstruction,
        shotOverride: options?.shotOverride,
        cameraAngleOverride: options?.cameraAngleOverride,
        subjectPlacement: options?.subjectPlacement,
        gazeDirection: options?.gazeDirection,
        compositionInstruction: options?.compositionInstruction,
      });
      setGenerationTargets((current) =>
        result.jobs.reduce(
          (next, job) => ({ ...next, [job.id]: result.panelId }),
          current,
        ),
      );
      setMessage(
        result.partial
          ? `${result.pageNumber}ページ ${result.panelNumber}コマ目は${result.jobs.length}案を開始しました。残りは利用枠を確認して再実行してください。`
          : `${result.pageNumber}ページ ${result.panelNumber}コマ目の候補${result.jobs.length}案を開始しました。`,
      );
      await Promise.all([refreshGenerationJobs(), refreshQuota()]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ネームから画像生成を開始できませんでした。",
      );
    } finally {
      setRequestingPanelGeneration(false);
    }
  }

  async function requestPanelInpainting(maskFile: File) {
    if (!selectedRevisionLayer?.assetId) return;
    setMessage("修正範囲を安全に保存しています…");
    try {
      const maskAsset = await uploadProjectAsset(project.id, maskFile);
      await requestStoryboardPanelGeneration({
        candidateCount: panelCandidateCount,
        sourceAssetId: selectedRevisionLayer.assetId,
        maskAssetId: maskAsset.id,
        revisionPreset,
        revisionInstruction: revisionInstruction.trim() || undefined,
      });
      setInpaintingDialogOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "部分修正を開始できませんでした。",
      );
    }
  }

  async function requestPanelOutpainting() {
    if (!selectedRevisionLayer?.assetId) return;
    await requestStoryboardPanelGeneration({
      candidateCount: panelCandidateCount,
      sourceAssetId: selectedRevisionLayer.assetId,
      outpaintingDirection,
      revisionPreset: "background",
      revisionInstruction: revisionInstruction.trim() || undefined,
    });
  }

  async function requestCloudTextGeneration() {
    if (!textGenerationPrompt.trim()) return;
    setMessage("AI文章生成を受け付けています…");
    try {
      await createGenerationJob({
        projectId: project.id,
        pageId: page.id,
        idempotencyKey: crypto.randomUUID(),
        generation: {
          kind: "text",
          jobType: textGenerationType,
          prompt: textGenerationPrompt,
          negativePrompt: "",
        },
      });
      setTextGenerationPrompt("");
      setMessage("AI文章生成を受け付けました。");
      await Promise.all([refreshGenerationJobs(), refreshQuota()]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "AI文章生成を受け付けられませんでした。",
      );
    }
  }

  function addGeneratedText(job: CloudGenerationJob) {
    const generated = job.output?.text;
    if (typeof generated !== "string" || !generated.trim()) return;
    const id = crypto.randomUUID();
    const timestamp = now();
    commit((draft) => {
      draft.textObjects.push({
        id,
        pageId: page.id,
        parentBalloonId: null,
        name: "AI生成テキスト",
        text: generated.slice(0, 20_000),
        writingMode: "vertical",
        x: canvas.width * 0.65,
        y: canvas.height * 0.15,
        width: canvas.width * 0.18,
        height: canvas.height * 0.35,
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
    setMessage("生成文章をCanvasテキストへ追加しました。");
  }

  async function cancelGenerationJob(jobId: string) {
    try {
      await cancelGeneration(jobId);
      setMessage("AI生成をキャンセルしました。");
      await Promise.all([refreshGenerationJobs(), refreshQuota()]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "AI生成をキャンセルできませんでした。",
      );
    }
  }

  async function placeGeneratedAsset(job: CloudGenerationJob) {
    const targetPanelId =
      generationTargets[job.id] ??
      job.target_panel_id ??
      (selection?.type === "panel" ? selection.id : null);
    if (!job.output_asset_id || !targetPanelId) return;
    let nextAssets: CloudAsset[];
    try {
      nextAssets = await listProjectAssets(project.id);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "生成Assetを取得できませんでした。",
      );
      return;
    }
    setAssets(nextAssets);
    const layerType =
      job.generation_operation === "inpainting" ||
      job.generation_operation === "outpainting"
        ? "correction"
        : job.job_type === "character_base"
        ? "character"
        : job.job_type === "prop"
          ? "prop"
          : job.job_type === "effect"
            ? "effect"
            : "background";
    applyAsset(job.output_asset_id, job.id, layerType, targetPanelId);
    setMessage("生成Assetを対象のコマへ配置しました。");
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
      await downloadCanvasPng({
        canvas,
        assets,
        fileName: `${project.title}-${String(page.page_number).padStart(3, "0")}.png`,
      });
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
  const selectedRevisionLayer = selectedPanelLayers.find(
    (layer) => layer.visible && Boolean(layer.assetId),
  );
  const selectedRevisionAsset = selectedRevisionLayer?.assetId
    ? assetMap.get(selectedRevisionLayer.assetId)
    : undefined;
  const comparisonJob = comparisonJobId
    ? generationJobs.find((job) => job.id === comparisonJobId)
    : undefined;
  const comparisonBeforeAsset = comparisonJob?.source_asset_id
    ? assetMap.get(comparisonJob.source_asset_id)
    : undefined;
  const comparisonAfterAsset = comparisonJob?.output_asset_id
    ? assetMap.get(comparisonJob.output_asset_id)
    : undefined;

  return (
    <div
      className="min-h-screen bg-stone-100"
      onClickCapture={(event) => {
        const anchor = (event.target as HTMLElement).closest("a[href]");
        if (
          !anchor ||
          !hasUnsavedChanges() ||
          window.confirm(
            "保存されていない変更があります。このページから移動しますか？",
          )
        )
          return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
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
            disabled={!canUndo}
            type="button"
          >
            <Undo2 className="mr-1 h-4 w-4" />
            戻す
          </button>
          <button
            className="button-secondary"
            onClick={redo}
            disabled={!canRedo}
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
            プレビュー
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
            href={creatorProjectExportUrl(project.id, "pdf")}
              >
                本編PDF
              </a>
              <a
                className="button-secondary"
            href={creatorProjectExportUrl(project.id, "images")}
              >
                連番画像ZIP
              </a>
              <a
                className="button-secondary"
            href={creatorProjectExportUrl(project.id, "package")}
              >
                販売パッケージ
              </a>
            </div>
          </details>
          <button
            className="button"
            onClick={() => void save()}
            disabled={
              saveState === "saving" ||
              saveState === "saved" ||
              saveState === "conflict"
            }
            type="button"
          >
            <Save className="mr-1 h-4 w-4" />
            {saveState === "saving"
              ? "保存中"
              : saveState === "saved"
                ? "保存済み"
                : saveState === "conflict"
                  ? "保存競合"
                : "保存"}
          </button>
        </div>
      </header>
      {saveState === "conflict" || saveState === "error" ? (
        <div
          className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 bg-red-50 p-3 text-red-800"
          role="alert"
        >
          <span className="min-w-0 flex-1">{message}</span>
          {saveState === "conflict" ? (
            <button
              className="button-secondary"
              onClick={() => window.location.reload()}
              type="button"
            >
              最新状態を再読込
            </button>
          ) : (
            <button
              className="button-secondary"
              onClick={() => void save()}
              type="button"
            >
              今すぐ再試行
            </button>
          )}
        </div>
      ) : message ? (
        <p className="mx-auto max-w-[1600px] bg-blue-50 p-3 text-blue-900">
          {message}
        </p>
      ) : null}
      <div className="mx-auto grid max-w-[1600px] gap-4 p-4 xl:grid-cols-[220px_minmax(480px,1fr)_320px]">
        <aside className="space-y-4">
          <section className="panel p-4">
            <h2 className="font-bold">ページ</h2>
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
            <h2 className="flex items-center gap-2 font-bold">
              <Sparkles className="h-5 w-5" /> AI制作アシスト
            </h2>
            <div className="mt-3 rounded border border-stone-200 bg-stone-50 p-2 text-xs">
              {quota ? (
                <>
                  <p className="font-bold">
                    {quota.plan_key.toUpperCase()}プラン・残り
                    {remainingCredits} クレジット
                  </p>
                  <p className="mt-1 text-stone-600">
                    使用 {quota.credits_used} / 予約 {quota.credits_reserved} /
                    上限 {quota.credits_limit}
                  </p>
                  {!quota.generation_enabled ? (
                    <p className="mt-1 text-red-700">
                      現在、生成は停止中です。
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-red-700">
                  利用枠を確認できないため生成できません。
                </p>
              )}
            </div>
            {storyboardPanelGenerationEnabled ? (
              <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
                <p className="text-sm font-bold text-violet-950">
                  AIおまかせ画像生成
                </p>
                <p className="mt-1 text-xs text-violet-800">
                  コマを選ぶだけで、ネームから比較用の候補を生成します。
                </p>
                <details className="mt-3 rounded-lg border border-violet-200 bg-white/70 p-3">
                  <summary className="cursor-pointer text-xs font-bold text-violet-950">
                    画角・ポーズを調整（任意）
                  </summary>
                  <p className="mt-2 text-[11px] leading-relaxed text-violet-700">
                    変更しなければネームの指定をそのまま使います。
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold text-violet-950">
                      画角
                      <select
                        className="field mt-1 w-full"
                        value={shotOverride}
                        onChange={(event) =>
                          setShotOverride(event.target.value as ShotOverride)
                        }
                      >
                        {Object.entries(shotOverrideLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-violet-950">
                      カメラ位置
                      <select
                        className="field mt-1 w-full"
                        value={cameraAngleOverride}
                        onChange={(event) =>
                          setCameraAngleOverride(
                            event.target.value as CameraAngleOverride,
                          )
                        }
                      >
                        {Object.entries(cameraAngleOverrideLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-violet-950">
                      人物配置
                      <select
                        className="field mt-1 w-full"
                        value={subjectPlacement}
                        onChange={(event) =>
                          setSubjectPlacement(
                            event.target.value as SubjectPlacement,
                          )
                        }
                      >
                        {Object.entries(subjectPlacementLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-violet-950">
                      視線方向
                      <select
                        className="field mt-1 w-full"
                        value={gazeDirection}
                        onChange={(event) =>
                          setGazeDirection(event.target.value as GazeDirection)
                        }
                      >
                        {Object.entries(gazeDirectionLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                  <label
                    className="mt-3 block text-xs font-bold text-violet-950"
                    htmlFor="panel-composition-instruction"
                  >
                    追加の構図指定（任意）
                  </label>
                  <input
                    className="field mt-1 w-full"
                    id="panel-composition-instruction"
                    maxLength={500}
                    placeholder="例：右手を前に伸ばす"
                    value={compositionInstruction}
                    onChange={(event) =>
                      setCompositionInstruction(event.target.value)
                    }
                  />
                </details>
                <label
                  className="mt-3 block text-xs font-bold text-violet-950"
                  htmlFor="panel-candidate-count"
                >
                  生成する候補数
                </label>
                <select
                  className="field mt-1 w-full"
                  id="panel-candidate-count"
                  value={panelCandidateCount}
                  onChange={(event) =>
                    setPanelCandidateCount(Number(event.target.value))
                  }
                >
                  <option value={2}>2案（節約）</option>
                  <option value={3}>3案（おすすめ）</option>
                  <option value={4}>4案（比較重視）</option>
                </select>
                <button
                  className="button mt-3 w-full"
                  disabled={
                    selection?.type !== "panel" ||
                    !quota?.generation_enabled ||
                    remainingCredits <= 0 ||
                    requestingPanelGeneration
                  }
                  onClick={() =>
                    void requestStoryboardPanelGeneration({
                      shotOverride,
                      cameraAngleOverride,
                      subjectPlacement,
                      gazeDirection,
                      compositionInstruction:
                        compositionInstruction.trim() || undefined,
                    })
                  }
                  type="button"
                >
                  {requestingPanelGeneration
                    ? "画像生成を受付中…"
                    : `選択したコマを${panelCandidateCount}案生成`}
                </button>
                <div className="mt-4 border-t border-violet-200 pt-4">
                  <p className="text-sm font-bold text-violet-950">
                    採用画像の気になる部分を直す
                  </p>
                  <p className="mt-1 text-xs text-violet-800">
                    選択中のコマ画像を参照し、構図を保った修正候補を作ります。
                    元画像はレイヤーに残るので、採用後も表示を戻せます。
                  </p>
                  <label
                    className="mt-3 block text-xs font-bold text-violet-950"
                    htmlFor="panel-revision-preset"
                  >
                    直したいところ
                  </label>
                  <select
                    className="field mt-1 w-full"
                    id="panel-revision-preset"
                    value={revisionPreset}
                    onChange={(event) =>
                      setRevisionPreset(event.target.value as RevisionPreset)
                    }
                  >
                    {Object.entries(revisionPresetLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label
                    className="mt-3 block text-xs font-bold text-violet-950"
                    htmlFor="panel-revision-instruction"
                  >
                    追加の要望（任意）
                  </label>
                  <textarea
                    className="field mt-1 min-h-20 w-full"
                    id="panel-revision-instruction"
                    maxLength={1000}
                    placeholder="例：主人公の目線を少し右へ"
                    value={revisionInstruction}
                    onChange={(event) =>
                      setRevisionInstruction(event.target.value)
                    }
                  />
                  {!selectedRevisionLayer ? (
                    <p className="mt-2 text-xs text-amber-800">
                      画像を配置済みのコマを選ぶと修正できます。
                    </p>
                  ) : null}
                  <button
                    className="button-secondary mt-3 w-full"
                    disabled={
                      !selectedRevisionLayer?.assetId ||
                      !quota?.generation_enabled ||
                      remainingCredits <= 0 ||
                      requestingPanelGeneration
                    }
                    onClick={() =>
                      void requestStoryboardPanelGeneration({
                        candidateCount: panelCandidateCount,
                        sourceAssetId: selectedRevisionLayer?.assetId ?? undefined,
                        revisionPreset,
                        revisionInstruction: revisionInstruction.trim() || undefined,
                      })
                    }
                    type="button"
                  >
                    {requestingPanelGeneration
                      ? "修正候補を受付中…"
                      : `修正候補を${panelCandidateCount}案生成`}
                  </button>
                  {panelInpaintingEnabled ? (
                    <>
                      <button
                        className="button mt-2 w-full"
                        disabled={
                          !selectedRevisionAsset ||
                          !quota?.generation_enabled ||
                          remainingCredits <= 0 ||
                          requestingPanelGeneration
                        }
                        onClick={() => setInpaintingDialogOpen(true)}
                        type="button"
                      >
                        直す範囲を塗って部分修正
                      </button>
                      <p className="mt-2 text-[11px] leading-relaxed text-violet-700">
                        部分修正では白く塗った範囲だけを置換します。元画像はレイヤーに残ります。
                      </p>
                    </>
                  ) : null}
                  {panelOutpaintingEnabled ? (
                    <div className="mt-3 rounded-lg border border-violet-200 bg-white/70 p-3">
                      <label
                        className="block text-xs font-bold text-violet-950"
                        htmlFor="panel-outpainting-direction"
                      >
                        画角を広げる方向
                      </label>
                      <select
                        className="field mt-1 w-full"
                        id="panel-outpainting-direction"
                        onChange={(event) =>
                          setOutpaintingDirection(
                            event.target.value as OutpaintingDirection,
                          )
                        }
                        value={outpaintingDirection}
                      >
                        {Object.entries(outpaintingDirectionLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      <button
                        className="button-secondary mt-2 w-full"
                        disabled={
                          !selectedRevisionAsset ||
                          !quota?.generation_enabled ||
                          remainingCredits <= 0 ||
                          requestingPanelGeneration
                        }
                        onClick={() => void requestPanelOutpainting()}
                        type="button"
                      >
                        {requestingPanelGeneration
                          ? "画角拡張を受付中…"
                          : `画角を広げた候補を${panelCandidateCount}案生成`}
                      </button>
                      <p className="mt-2 text-[11px] leading-relaxed text-violet-700">
                        元画像の外側だけをAIが補完し、より広い構図の候補を作ります。元画像は残ります。
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <label
              className="mt-3 block text-xs font-bold"
              htmlFor="cloud-generation-type"
            >
              生成種別
            </label>
            <select
              className="field mt-1 w-full"
              id="cloud-generation-type"
              value={generationType}
              onChange={(event) =>
                setGenerationType(event.target.value as typeof generationType)
              }
            >
              <option value="background">背景</option>
              <option value="prop">小物</option>
              <option value="effect">効果</option>
              <option value="character_base">キャラクター</option>
            </select>
            <label
              className="mt-3 block text-xs font-bold"
              htmlFor="cloud-generation-prompt"
            >
              生成内容
            </label>
            <textarea
              className="field mt-1 min-h-24 w-full"
              id="cloud-generation-prompt"
              maxLength={20000}
              value={generationPrompt}
              onChange={(event) => setGenerationPrompt(event.target.value)}
            />
            <button
              className="button mt-2 w-full"
              disabled={
                !generationPrompt.trim() ||
                !quota?.generation_enabled ||
                remainingCredits <= 0
              }
              onClick={() => void requestCloudGeneration()}
              type="button"
            >
              一般向け画像を生成
            </button>
            <hr className="my-4 border-stone-200" />
            <label
              className="block text-xs font-bold"
              htmlFor="cloud-text-generation-type"
            >
              文章生成種別
            </label>
            <select
              className="field mt-1 w-full"
              id="cloud-text-generation-type"
              value={textGenerationType}
              onChange={(event) =>
                setTextGenerationType(
                  event.target.value as typeof textGenerationType,
                )
              }
            >
              <option value="speech_bubble">セリフ</option>
              <option value="storyboard">ネーム案</option>
              <option value="story">物語案</option>
            </select>
            <textarea
              aria-label="文章の生成内容"
              className="field mt-2 min-h-20 w-full"
              maxLength={20000}
              value={textGenerationPrompt}
              onChange={(event) => setTextGenerationPrompt(event.target.value)}
            />
            <button
              className="button-secondary mt-2 w-full"
              disabled={
                !textGenerationPrompt.trim() ||
                !quota?.generation_enabled ||
                remainingCredits <= 0
              }
              onClick={() => void requestCloudTextGeneration()}
              type="button"
            >
              一般向け文章を生成
            </button>
            <div className="mt-3 space-y-2" aria-live="polite">
              {generationJobs.slice(0, 8).map((job) => (
                <div
                  className="rounded border border-stone-200 bg-white p-2 text-xs"
                  key={job.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {job.revision_preset
                        ? `${job.generation_operation === "inpainting" ? "部分修正" : job.generation_operation === "outpainting" ? "画角拡張" : "修正候補"}・${revisionPresetLabels[job.revision_preset]}`
                        : job.job_type} / {job.status} / {job.progress}%
                    </span>
                    {job.status === "queued" || job.status === "running" ? (
                      <button
                        className="text-red-700 underline"
                        onClick={() => void cancelGenerationJob(job.id)}
                        type="button"
                      >
                        中止
                      </button>
                    ) : null}
                  </div>
                  {job.output_asset_id && assetMap.get(job.output_asset_id) ? (
                    <img
                      alt="生成されたコマ候補"
                      className="mt-2 aspect-video w-full rounded border border-stone-200 object-cover"
                      src={assetMap.get(job.output_asset_id)!.url}
                    />
                  ) : null}
                  {job.status === "completed" &&
                  job.kind === "image" &&
                  job.revision_preset &&
                  job.source_asset_id &&
                  job.output_asset_id &&
                  assetMap.has(job.source_asset_id) &&
                  assetMap.has(job.output_asset_id) ? (
                    <button
                      className="button-secondary mt-2 w-full"
                      onClick={() => setComparisonJobId(job.id)}
                      type="button"
                    >
                      修正前と比較
                    </button>
                  ) : null}
                  {job.status === "failed" ? (
                    <div className="mt-2 rounded bg-red-50 p-2 text-red-800">
                      <p>生成に失敗しました。この候補だけ再実行できます。</p>
                      {job.target_panel_id ? (
                        <button
                          className="mt-1 font-bold underline"
                          disabled={requestingPanelGeneration}
                          onClick={() =>
                            void requestStoryboardPanelGeneration({
                              panelId: job.target_panel_id!,
                              candidateCount: 1,
                            })
                          }
                          type="button"
                        >
                          このコマだけ再実行
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {job.status === "completed" && job.output_asset_id ? (
                    <button
                      className="button-secondary mt-2 w-full"
                      disabled={
                        !generationTargets[job.id] &&
                        !job.target_panel_id &&
                        selection?.type !== "panel"
                      }
                      onClick={() => void placeGeneratedAsset(job)}
                      type="button"
                    >
                      {generationTargets[job.id] || job.target_panel_id
                        ? "この候補を採用してコマへ配置"
                        : "選択中のコマへ配置"}
                    </button>
                  ) : null}
                  {job.status === "completed" &&
                  job.kind === "text" &&
                  typeof job.output?.text === "string" ? (
                    <button
                      className="button-secondary mt-2 w-full"
                      onClick={() => addGeneratedText(job)}
                      type="button"
                    >
                      Canvasテキストへ追加
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
          <section className="panel p-4">
            <h2 className="font-bold">画像素材</h2>
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
            aria-label={`${page.page_number}ページの編集画面`}
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
                return (
                  <div
                    className={`absolute ${selection?.type === "panel" && selection.id === panel.id ? "ring-4 ring-blue-500" : ""}`}
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
                      touchAction: "none",
                    }}
                  >
                    <img
                      alt=""
                      draggable={false}
                      className="h-full w-full"
                      src={panelPreviewUrls.get(panel.id)}
                    />
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
      {inpaintingDialogOpen && selectedRevisionAsset ? (
        <PanelInpaintingDialog
          onCancel={() => setInpaintingDialogOpen(false)}
          onSubmit={requestPanelInpainting}
          revisionPreset={revisionPreset}
          sourceHeight={selectedRevisionAsset.height}
          sourceUrl={selectedRevisionAsset.url}
          sourceWidth={selectedRevisionAsset.width}
          submitting={requestingPanelGeneration}
        />
      ) : null}
      {comparisonJob && comparisonBeforeAsset && comparisonAfterAsset ? (
        <PanelImageComparisonDialog
          after={comparisonAfterAsset}
          before={comparisonBeforeAsset}
          direction={comparisonJob.outpainting_direction}
          onAdopt={() => {
            setComparisonJobId(null);
            void placeGeneratedAsset(comparisonJob);
          }}
          onClose={() => setComparisonJobId(null)}
        />
      ) : null}
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
              プレビューを閉じる
            </button>
            <img
              alt={`${project.title} ${page.page_number}ページのプレビュー`}
              className="mx-auto max-h-[80vh] max-w-[80vw] bg-white object-contain"
              src={previewUrl}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
