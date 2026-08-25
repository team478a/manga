"use client";
/* eslint-disable @next/next/no-img-element -- Canvas uses private signed URLs and raw image dimensions. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type { CloudPageDialoguePlacement } from "@/modules/cloud-creator/canvas/dialogue-placement-service";
import type { CloudPageCompletion } from "@/modules/cloud-creator/projects/page-completion-service";
import { buildGenerationRecoveryPresentation } from "@/modules/cloud-ai/domain/generation-recovery-presentation";
import { PageCompletionBanner } from "./PageCompletionBanner";
import { CanvasImageGenerationNotice } from "./CanvasImageGenerationNotice";
import { buildPanelRevisionRequest } from "@/modules/manga/application/build-panel-revision";
import {
  applyPanelCandidateAdoption,
  countReversedPanelBackgroundStacks,
  detachRejectedPanelCandidate,
  repairReversedPanelBackgroundStacks,
} from "@/modules/manga/domain/panel-adoption";
import {
  countRepairableShortVerticalDialogue,
  repairShortVerticalDialogueLayout,
} from "@/modules/manga/domain/dialogue-placement";
import {
  candidateBelongsToPage,
  classifyCandidateLayer,
  filterGenerationJobsForPage,
  hasActivePanelGeneration,
  hasUnresolvedPanelGeneration,
  resolveCandidateTargetPanelId,
  type PanelGenerationTarget,
} from "@/modules/manga/domain/panel-candidate";
import { useCanvasAutosave } from "./hooks/useCanvasAutosave";
import { useCanvasHistory } from "./hooks/useCanvasHistory";
import {
  useCanvasPointer,
  type CanvasSelection,
} from "./hooks/useCanvasPointer";
import { downloadCanvasPng } from "./services/canvas-download";
import { createCanvasSvg } from "./services/canvas-svg";
import {
  acquirePageEditLease,
  getOrCreatePageEditLockToken,
} from "./services/page-edit-lock-client";
import { PanelInpaintingDialog } from "./PanelInpaintingDialog";
import { PanelImageComparisonDialog } from "./PanelImageComparisonDialog";
import { PanelImageQualityReviewDialog } from "./PanelImageQualityReviewDialog";
import { MonitorQualityFeedback } from "./MonitorQualityFeedback";
import { PanelDesignInspector } from "./PanelDesignInspector";
import {
  cancelGeneration,
  createGenerationJob,
  createStoryboardPanelGenerationJob,
  getAiQuota,
  getAssetUrl,
  listGenerationJobs,
  listProjectAssets,
  recordMangaQualityEvent,
  retryGeneration,
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
type ImageQualityReviewRequest = {
  jobId: string;
  action: "place" | "approve";
};
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
const panelGenerationTargetLabels: Record<PanelGenerationTarget, string> = {
  composite: "完成コマ（背景・人物・効果）",
  background: "背景だけ",
  character: "人物だけ",
  effect: "効果だけ",
};

function generationStatusLabel(job: CloudGenerationJob) {
  if (job.status === "queued" || job.status === "running") return "生成中";
  if (job.status === "failed") return "生成失敗・再実行可能";
  if (job.status === "canceled") return "中止";
  if (job.kind === "text") return "文章生成完了";
  if (job.panel_adoption_status === "auto_placed")
    return "Canvasへ自動配置済み";
  if (
    job.panel_adoption_status === "review_required" ||
    job.panel_adoption_status === "rejected"
  )
    return "手動確認待ち";
  if (job.panel_adoption_status === "placement_failed")
    return job.panel_adoption_retryable
      ? "配置失敗・再実行可能"
      : "配置失敗";
  return "画像生成完了";
}

function GenerationRecoveryStatus({ job }: { job: CloudGenerationJob }) {
  if (!job.recovery_ui_enabled) return null;
  const recovery = buildGenerationRecoveryPresentation({
    status: job.status,
    executionPhase: job.execution_phase,
    failureStage: job.failure_stage,
    retryDisposition: job.retry_disposition,
    lastCheckpointAt: job.last_checkpoint_at,
  });
  return (
    <div className="mb-2 rounded bg-violet-50 p-2 text-violet-950" data-testid="generation-recovery-status">
      <p className="font-bold">{recovery.phaseLabel}</p>
      {recovery.failureStageLabel ? <p>失敗工程: {recovery.failureStageLabel}</p> : null}
      {recovery.recoveryLabel ? <p>{recovery.recoveryLabel}</p> : null}
      {recovery.lastCheckpointAt ? (
        <p className="text-[11px] text-violet-800">
          最終記録: {new Date(recovery.lastCheckpointAt).toLocaleString("ja-JP")}
        </p>
      ) : null}
    </div>
  );
}

function cloneCanvas(canvas: PageCanvas): PageCanvas {
  return structuredClone(canvas);
}

function now() {
  return new Date().toISOString();
}

export function CloudCanvasEditor({
  project,
  pages,
  page,
  initialCanvas,
  initialAssets,
  initialGenerationJobs,
  initialQuota,
  initialDialoguePlacement,
  initialPageCompletion,
  storyboardPanelGenerationEnabled,
  panelInpaintingEnabled,
  panelOutpaintingEnabled,
  monitorQualityFeedbackEnabled,
}: {
  project: CloudProjectSummary;
  pages: CloudPage[];
  page: CloudPage;
  initialCanvas: PageCanvas;
  initialAssets: CloudAsset[];
  initialGenerationJobs: CloudGenerationJob[];
  initialQuota: CloudAiQuota | null;
  initialDialoguePlacement: CloudPageDialoguePlacement | null;
  initialPageCompletion: CloudPageCompletion | null;
  storyboardPanelGenerationEnabled: boolean;
  panelInpaintingEnabled: boolean;
  panelOutpaintingEnabled: boolean;
  monitorQualityFeedbackEnabled: boolean;
}) {
  const router = useRouter();
  const [pageLockState, setPageLockState] = useState<"checking" | "acquired" | "locked" | "unavailable">("checking");
  const pageLockToken = useMemo(
    () => getOrCreatePageEditLockToken(page.id),
    [page.id],
  );
  useEffect(() => {
    let active = true;
    setPageLockState("checking");
    const renew = async () => {
      const state = await acquirePageEditLease(page.id, pageLockToken);
      if (active) setPageLockState(state);
    };
    void renew();
    const timer = window.setInterval(renew, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      // A reload can mount the replacement before an asynchronous DELETE
      // completes. The server lease expires closed tabs after 120 seconds.
    };
  }, [page.id, pageLockToken]);
  const [canvas, setCanvas] = useState(() => cloneCanvas(initialCanvas));
  const [assets, setAssets] = useState(initialAssets);
  const [generationJobs, setGenerationJobs] = useState(() =>
    filterGenerationJobsForPage(initialGenerationJobs, page.id),
  );
  const recordedDisplayedJobIds = useRef(new Set<string>());
  const reloadingAutoPlacement = useRef(false);
  const [generationTargets, setGenerationTargets] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      filterGenerationJobsForPage(initialGenerationJobs, page.id)
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
  const [panelGenerationTarget, setPanelGenerationTarget] =
    useState<PanelGenerationTarget>("composite");
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
  const [imageQualityReview, setImageQualityReview] =
    useState<ImageQualityReviewRequest | null>(null);
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
  const previewSvg = useMemo(
    () => createCanvasSvg(canvas, canvasSvgAssets),
    [canvas, canvasSvgAssets],
  );
  const panelPreviewSvgs = useMemo(
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
            createCanvasSvg(panelCanvas, canvasSvgAssets),
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
    setGenerationJobs(
      filterGenerationJobsForPage(
        await listGenerationJobs(project.id, page.id),
        page.id,
      ),
    );
  }, [page.id, project.id]);

  const refreshQuota = useCallback(async () => {
    setQuota(await getAiQuota());
  }, []);

  useEffect(() => {
    if (
      !generationJobs.some(
        (job) =>
          job.status === "queued" ||
          job.status === "running" ||
          (job.status === "completed" &&
            job.kind === "image" &&
            job.panel_adoption_eligible &&
            !job.panel_adoption_status),
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
    const placedJob = generationJobs.find(
      (job) =>
        job.panel_adoption_status === "auto_placed" &&
        job.quality_review_status !== "rejected" &&
        !canvas.panelLayers.some((layer) => layer.sourceJobId === job.id),
    );
    if (!placedJob || reloadingAutoPlacement.current) return;
    if (saveState !== "saved" || hasUnsavedChanges()) {
      setMessage(
        "生成画像はCanvasへ保存済みです。編集中の内容を確認してから最新状態を読み込んでください。",
      );
      return;
    }
    reloadingAutoPlacement.current = true;
    setMessage("生成画像を反映するため最新のCanvasを読み込んでいます…");
    window.location.reload();
  }, [canvas.panelLayers, generationJobs, hasUnsavedChanges, saveState]);

  useEffect(() => {
    for (const job of generationJobs) {
      if (
        job.status !== "completed" ||
        !job.output_asset_id ||
        recordedDisplayedJobIds.current.has(job.id)
      )
        continue;
      recordedDisplayedJobIds.current.add(job.id);
      void recordMangaQualityEvent({
        event: "displayed",
        generationJobId: job.id,
      }).catch(() => undefined);
    }
  }, [generationJobs]);

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
  const rejectedPlacedJobIds = useMemo(
    () =>
      generationJobs
        .filter(
          (job) =>
            job.quality_review_status === "rejected" &&
            canvas.panelLayers.some((layer) => layer.sourceJobId === job.id),
        )
        .map((job) => job.id),
    [canvas.panelLayers, generationJobs],
  );
  const repairableShortDialogueCount = useMemo(
    () => countRepairableShortVerticalDialogue(canvas),
    [canvas],
  );
  const reversedBackgroundStackCount = useMemo(
    () => countReversedPanelBackgroundStacks(canvas),
    [canvas],
  );
  const existingManuscriptRepairCount =
    rejectedPlacedJobIds.length +
    repairableShortDialogueCount +
    reversedBackgroundStackCount;

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
      if (pageLockState !== "acquired") return;
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
  }, [deleteSelected, pageLockState, redo, undo]);

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
    if (!panelId || !canvas.panels.some((panel) => panel.id === panelId))
      return false;
    if (
      canvas.panelLayers.some(
        (layer) =>
          layer.panelId === panelId &&
          ((sourceJobId && layer.sourceJobId === sourceJobId) ||
            layer.assetId === assetId),
      )
    )
      return true;
    const layerId = crypto.randomUUID();
    const timestamp = now();
    return commit((draft) => {
      applyPanelCandidateAdoption(draft, {
        assetId,
        assetFileName: assetMap.get(assetId)?.file_name,
        layerId,
        layerType,
        sourceJobId,
        targetPanelId: panelId,
        timestamp,
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
    generationTarget?: PanelGenerationTarget;
  }) {
    const panelId =
      options?.panelId ?? (selection?.type === "panel" ? selection.id : null);
    if (!panelId || requestingPanelGeneration) return;
    const candidateCount = options?.candidateCount ?? panelCandidateCount;
    setRequestingPanelGeneration(true);
    setMessage(`${candidateCount}案の画像生成を準備しています…`);
    try {
      const result = await createStoryboardPanelGenerationJob(buildPanelRevisionRequest({
        projectId: project.id,
        pageId: page.id,
        panelId,
        idempotencyKey: crypto.randomUUID(),
        candidateCount,
        options,
      }));
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

  async function placeGeneratedAssetAfterReview(job: CloudGenerationJob) {
    if (!candidateBelongsToPage(job, page.id)) {
      setMessage("この画像候補は別のページ用のため配置できません。");
      return;
    }
    const targetPanelId = resolveCandidateTargetPanelId({
      job,
      generationTargets,
      selectedPanelId: selection?.type === "panel" ? selection.id : null,
    });
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
    const layerType = classifyCandidateLayer(job);
    if (applyAsset(job.output_asset_id, job.id, layerType, targetPanelId)) {
      try {
        await recordMangaQualityEvent({
          event: "selected",
          generationJobId: job.id,
        });
        setGenerationJobs((current) =>
          current.map((item) =>
            item.id === job.id
              ? { ...item, quality_review_status: "approved" }
              : item,
          ),
        );
        setMessage("生成Assetを対象のコマへ配置し、品質確認を記録しました。");
        router.refresh();
      } catch {
        setMessage("画像は配置しました。販売準備の前に画像の品質確認を完了してください。");
      }
    } else setMessage("生成Assetをコマへ配置できませんでした。");
  }

  async function approveGeneratedAssetAfterReview(job: CloudGenerationJob) {
    try {
      await recordMangaQualityEvent({
        event: "selected",
        generationJobId: job.id,
      });
      setGenerationJobs((current) =>
        current.map((item) =>
          item.id === job.id
            ? { ...item, quality_review_status: "approved" }
            : item,
        ),
      );
      setMessage("このコマの原稿画像を品質確認済みにしました。");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "画像の品質確認を保存できませんでした。",
      );
    }
  }

  async function rejectGeneratedAsset(job: CloudGenerationJob) {
    try {
      await recordMangaQualityEvent({
        event: "rejected",
        generationJobId: job.id,
        rejectedReason: "原稿品質の必須確認で不採用",
      });
      const detached = canvas.panelLayers.some(
        (layer) => layer.sourceJobId === job.id,
      )
        ? commit((draft) => {
            detachRejectedPanelCandidate(draft, job.id);
          })
        : false;
      setGenerationJobs((current) =>
        current.map((item) =>
          item.id === job.id
            ? { ...item, quality_review_status: "rejected" }
            : item,
        ),
      );
      setMessage(
        detached
          ? "この候補を不採用にし、Canvasから外しました。保存完了まで画面を閉じないでください。"
          : "この候補を不採用にしました。作り直さない限り追加クレジットは消費しません。",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "候補の不採用を保存できませんでした。",
      );
    }
  }

  function detachRejectedGeneratedAsset(job: CloudGenerationJob) {
    if (job.quality_review_status !== "rejected") return;
    const committed = commit((draft) => {
      detachRejectedPanelCandidate(draft, job.id);
    });
    setMessage(
      committed
        ? "不採用画像をCanvasから外しました。追加生成とクレジット消費はありません。保存完了まで画面を閉じないでください。"
        : "不採用画像をCanvasから外せませんでした。Canvasを再読み込みして確認してください。",
    );
  }

  function repairExistingManuscript() {
    if (!existingManuscriptRepairCount) return;
    const timestamp = now();
    let detachedCount = 0;
    let repairedTextCount = 0;
    let repairedBackgroundCount = 0;
    const committed = commit((draft) => {
      for (const jobId of rejectedPlacedJobIds) {
        if (detachRejectedPanelCandidate(draft, jobId)) detachedCount += 1;
      }
      repairedTextCount = repairShortVerticalDialogueLayout(draft, timestamp);
      repairedBackgroundCount = repairReversedPanelBackgroundStacks(
        draft,
        timestamp,
      );
    });
    if (!committed) {
      setMessage(
        "既存原稿を修復できませんでした。Canvasを再読み込みして確認してください。",
      );
      return;
    }
    setMessage(
      `既存原稿を修復しました（不採用画像 ${detachedCount}件・短い縦書き ${repairedTextCount}件・背景順 ${repairedBackgroundCount}コマ）。追加生成とクレジット消費はありません。保存済みになった後、ページを再読み込みして完成判定を確認してください。`,
    );
  }

  function requestImageQualityReview(
    job: CloudGenerationJob,
    action: ImageQualityReviewRequest["action"],
  ) {
    if (!job.output_asset_id || !assetMap.has(job.output_asset_id)) {
      setMessage("品質確認する生成画像を表示できませんでした。");
      return;
    }
    setImageQualityReview({ jobId: job.id, action });
  }

  async function rejectAndRegeneratePanel(job: CloudGenerationJob) {
    if (!job.target_panel_id || requestingPanelGeneration) return;
    try {
      await recordMangaQualityEvent({
        event: "rejected",
        generationJobId: job.id,
        rejectedReason: "原稿品質の目視確認で作り直し",
      });
      if (canvas.panelLayers.some((layer) => layer.sourceJobId === job.id))
        commit((draft) => {
          detachRejectedPanelCandidate(draft, job.id);
        });
      setGenerationJobs((current) =>
        current.map((item) =>
          item.id === job.id
            ? { ...item, quality_review_status: "rejected" }
            : item,
        ),
      );
      await requestStoryboardPanelGeneration({
        panelId: job.target_panel_id,
        candidateCount: 1,
        compositionInstruction:
          "前の候補とは異なる明瞭な構図で再制作する。人物の姿勢と重力、手指と小物の接触、衣服と小物の境界、無地の物体表面を優先して仕上げる。",
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "このコマの作り直しを開始できませんでした。",
      );
    }
  }

  async function retryFailedPanelGeneration(job: CloudGenerationJob) {
    if (!job.target_panel_id || requestingPanelGeneration) return;
    setRequestingPanelGeneration(true);
    setMessage("失敗したコマの生成条件を安全に確認しています…");
    try {
      await retryGeneration(job.id);
      setMessage(
        job.error_code === "provider_rejected" ||
          job.error_code === "provider_moderation_blocked"
          ? "Providerに拒否された表現を一般向けの間接表現へ再構成し、このコマだけ再実行しました。"
          : "失敗した生成条件を引き継ぎ、このコマだけ再実行しました。",
      );
      await Promise.all([refreshGenerationJobs(), refreshQuota()]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "このコマの再実行を開始できませんでした。",
      );
    } finally {
      setRequestingPanelGeneration(false);
    }
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
  const imageQualityReviewJob = imageQualityReview
    ? generationJobs.find((job) => job.id === imageQualityReview.jobId)
    : undefined;
  const imageQualityReviewAsset = imageQualityReviewJob?.output_asset_id
    ? assetMap.get(imageQualityReviewJob.output_asset_id)
    : undefined;
  const editingBlocked = pageLockState !== "acquired";

  return (
    <div
      aria-busy={pageLockState === "checking"}
      className="relative min-h-screen bg-stone-100"
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
      {editingBlocked ? (
        <div
          aria-modal="true"
          aria-live="polite"
          className="fixed inset-0 z-50 grid place-items-center bg-stone-950/70 p-5"
          role="dialog"
        >
          <div className="max-w-md rounded-xl bg-white p-6 text-center shadow-xl">
            <Lock className="mx-auto h-8 w-8 text-violet-700" />
            {pageLockState === "checking" ? (
              <>
                <h1 className="mt-3 text-xl font-bold">
                  編集状態を確認しています
                </h1>
                <p className="mt-2 text-sm text-stone-600">
                  確認が完了するまで編集操作をお待ちください。
                </p>
              </>
            ) : pageLockState === "locked" ? (
              <>
                <h1 className="mt-3 text-xl font-bold">
                  このページは別の画面で編集中です
                </h1>
                <p className="mt-2 text-sm text-stone-600">
                  別の画面を閉じて約2分待ってから再読み込みしてください。上書きを防ぐため、この画面では編集できません。
                </p>
                <Link
                  className="button-secondary mt-4 inline-flex"
                  href={`/creator/${project.id}`}
                >
                  作品画面へ戻る
                </Link>
              </>
            ) : (
              <>
                <h1 className="mt-3 text-xl font-bold">
                  編集状態を確認できませんでした
                </h1>
                <p className="mt-2 text-sm text-stone-600">
                  通信状態を確認して再読み込みしてください。安全のため、この画面では編集できません。
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    className="button"
                    onClick={() => window.location.reload()}
                    type="button"
                  >
                    再読み込み
                  </button>
                  <Link
                    className="button-secondary"
                    href={`/creator/${project.id}`}
                  >
                    作品画面へ戻る
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      <div aria-hidden={editingBlocked} inert={editingBlocked}>
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
              <Link
                className="button-secondary"
                href={`/creator/${project.id}#durable-export`}
              >
                安全な完成PDF書き出しへ
              </Link>
              <p className="text-xs leading-5 text-stone-600">
                作品画面で4ページずつ処理します。画面を閉じても継続し、失敗箇所から再開できます。
              </p>
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
              onClick={() => {
                if (
                  window.confirm(
                    "別のタブまたは端末で保存された最新状態を読み込みます。この画面の未保存変更は破棄されます。続けますか？",
                  )
                )
                  window.location.reload();
              }}
              type="button"
            >
              最新状態を読み込む
            </button>
          ) : (
            <button
              className="button-secondary"
              onClick={() => void save()}
              type="button"
            >
              未保存内容を保ったまま再試行
            </button>
          )}
        </div>
      ) : message ? (
        <p className="mx-auto max-w-[1600px] bg-blue-50 p-3 text-blue-900">
          {message}
        </p>
      ) : null}
      {initialDialoguePlacement ? (
        <div
          className={`mx-auto max-w-[1600px] p-3 text-sm ${
            initialDialoguePlacement.status === "auto_placed"
              ? "bg-green-50 text-green-900"
              : initialDialoguePlacement.status === "review_required"
                ? "bg-amber-50 text-amber-900"
                : "bg-red-50 text-red-900"
          }`}
          role={
            initialDialoguePlacement.status === "auto_placed"
              ? "status"
              : "alert"
          }
        >
          {initialDialoguePlacement.status === "auto_placed"
            ? `構造化セリフを自動配置済みです（${initialDialoguePlacement.placed_dialogue_count}/${initialDialoguePlacement.dialogue_count}件）。`
            : initialDialoguePlacement.status === "review_required"
              ? `セリフ配置に確認が必要です（${initialDialoguePlacement.placed_dialogue_count}/${initialDialoguePlacement.dialogue_count}件）。手動テキストを保護した箇所、または吹き出し内に収まらない箇所があります。`
              : "セリフの自動配置を完了できませんでした。再処理後も解消しない場合は運営へ連絡してください。"}
        </div>
      ) : null}
      {initialPageCompletion ? (
        <PageCompletionBanner
          completion={initialPageCompletion}
          projectId={project.id}
          pageId={page.id}
        />
      ) : null}
      {existingManuscriptRepairCount ? (
        <section
          aria-labelledby="existing-manuscript-repair"
          className="mx-auto max-w-[1600px] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          role="alert"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong id="existing-manuscript-repair">
                既存原稿に安全に修復できる箇所があります
              </strong>
              <p className="mt-1">
                不採用画像 {rejectedPlacedJobIds.length}件・短い縦書き{" "}
                {repairableShortDialogueCount}件・背景順{" "}
                {reversedBackgroundStackCount}コマ。画像の追加生成やクレジット消費はありません。
              </p>
            </div>
            <button
              className="button-secondary"
              disabled={pageLockState !== "acquired"}
              onClick={repairExistingManuscript}
              type="button"
            >
              既存原稿を修復
            </button>
          </div>
        </section>
      ) : null}
      <CanvasImageGenerationNotice
        canvas={canvas}
        generationJobs={generationJobs}
        projectId={project.id}
        storyboardPanelGenerationEnabled={storyboardPanelGenerationEnabled}
      />
      <div className="mx-auto grid max-w-[1600px] gap-4 p-4 min-[1360px]:grid-cols-[220px_minmax(480px,1fr)_320px]">
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
                <label
                  className="mt-3 block text-xs font-bold text-violet-950"
                  htmlFor="panel-generation-target"
                >
                  生成するレイヤー
                </label>
                <select
                  className="field mt-1 w-full"
                  id="panel-generation-target"
                  value={panelGenerationTarget}
                  onChange={(event) =>
                    setPanelGenerationTarget(
                      event.target.value as PanelGenerationTarget,
                    )
                  }
                >
                  {Object.entries(panelGenerationTargetLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ),
                  )}
                </select>
                {panelGenerationTarget !== "composite" ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-violet-700">
                    分離素材は別レイヤーとして採用され、背景・人物・効果を個別に表示・並べ替えできます。
                  </p>
                ) : null}
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
                      generationTarget: panelGenerationTarget,
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
                  <GenerationRecoveryStatus job={job} />
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {job.revision_preset
                        ? `${job.generation_operation === "inpainting" ? "部分修正" : job.generation_operation === "outpainting" ? "画角拡張" : "修正候補"}・${revisionPresetLabels[job.revision_preset]}`
                        : job.job_type} / {generationStatusLabel(job)} / {job.progress}%
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
                  <details className="mt-2 rounded bg-stone-50 p-2">
                    <summary className="cursor-pointer font-bold">生成の追跡情報</summary>
                    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2">
                      <dt>Provider / Model</dt><dd>{job.generation_provenance.providerId} / {job.generation_provenance.modelId}</dd>
                      <dt>Seed</dt><dd>{job.generation_provenance.seed ?? "未指定"}</dd>
                      <dt>Workflow</dt><dd>{job.generation_provenance.workflowVersion ?? "従来経路"}</dd>
                      <dt>人物version</dt><dd>{job.generation_provenance.characterVersions.length}件</dd>
                      <dt>承認済み参照</dt><dd>{job.generation_provenance.references.length}件</dd>
                      <dt>参照resolver</dt><dd>{job.generation_provenance.referenceResolverVersion ?? "未使用"}</dd>
                      <dt>場所・小物version</dt><dd>{job.generation_provenance.worldVersions.length}件</dd>
                      <dt>連続状態</dt><dd>{job.generation_provenance.continuityStateCount}件</dd>
                    </dl>
                  </details>
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
                      <p>
                        {job.target_panel_id &&
                        hasActivePanelGeneration(
                          generationJobs,
                          job.target_panel_id,
                          job.id,
                        )
                          ? "同じコマの生成または候補確認が進行中です。"
                          : "生成に失敗しました。この候補だけ再実行できます。"}
                      </p>
                      {job.target_panel_id ? (
                        <button
                          className="mt-1 font-bold underline"
                          disabled={
                            requestingPanelGeneration ||
                            hasActivePanelGeneration(
                              generationJobs,
                              job.target_panel_id,
                              job.id,
                            )
                          }
                          onClick={() => void retryFailedPanelGeneration(job)}
                          type="button"
                        >
                          このコマだけ再実行
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {job.status === "completed" &&
                  job.output_asset_id &&
                  job.quality_review_status !== "rejected" &&
                  job.panel_adoption_status !== "auto_placed" &&
                  !canvas.panelLayers.some(
                    (layer) => layer.sourceJobId === job.id,
                  ) ? (
                    <div className="mt-2 grid gap-2">
                      <button
                        className="button-secondary w-full"
                        disabled={
                          !generationTargets[job.id] &&
                          !job.target_panel_id &&
                          selection?.type !== "panel"
                        }
                        onClick={() => requestImageQualityReview(job, "place")}
                        type="button"
                      >
                        {generationTargets[job.id] || job.target_panel_id
                          ? job.panel_adoption_status === "review_required" ||
                            job.panel_adoption_status === "placement_failed"
                            ? "確認してコマへ配置"
                            : "この候補を採用してコマへ配置"
                          : "選択中のコマへ配置"}
                      </button>
                      {job.kind === "image" && job.target_panel_id ? (
                        <button
                          className="button-secondary w-full"
                          disabled={
                            requestingPanelGeneration ||
                            hasUnresolvedPanelGeneration(
                              generationJobs,
                              job.target_panel_id,
                              job.id,
                            )
                          }
                          onClick={() => void rejectAndRegeneratePanel(job)}
                          type="button"
                        >
                          この候補を使わず作り直す（1案）
                        </button>
                      ) : null}
                      {job.kind === "image" ? (
                        <button
                          className="button-secondary w-full"
                          onClick={() => void rejectGeneratedAsset(job)}
                          type="button"
                        >
                          この候補を不採用にする（追加生成なし）
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {job.status === "completed" &&
                  job.kind === "image" &&
                  job.output_asset_id &&
                  job.quality_review_status === "rejected" &&
                  !canvas.panelLayers.some(
                    (layer) => layer.sourceJobId === job.id,
                  ) ? (
                    <p className="mt-2 rounded bg-stone-100 p-2 text-stone-600">
                      この候補は不採用済みです。
                    </p>
                  ) : null}
                  {job.status === "completed" &&
                  job.kind === "image" &&
                  canvas.panelLayers.some((layer) => layer.sourceJobId === job.id) ? (
                    job.quality_review_status === "approved" ? (
                      <div className="mt-2 grid gap-2 rounded bg-green-50 p-2 text-green-800">
                        <p className="font-bold">原稿画像を品質確認済み</p>
                        {job.target_panel_id ? (
                          <button
                            className="button-secondary w-full"
                            disabled={
                              requestingPanelGeneration ||
                              hasUnresolvedPanelGeneration(
                                generationJobs,
                                job.target_panel_id,
                                job.id,
                              )
                            }
                            onClick={() => void rejectAndRegeneratePanel(job)}
                            type="button"
                          >
                            品質確認を取り消して作り直す（1案）
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-950">
                        <p className="font-bold">
                          {job.quality_review_status === "rejected"
                            ? "この画像は作り直しが必要です"
                            : "販売原稿に使える画像か目視確認してください"}
                        </p>
                        <div className="mt-2 grid gap-2">
                          {job.quality_review_status !== "rejected" ? (
                            <button
                              className="button-secondary w-full"
                              onClick={() => requestImageQualityReview(job, "approve")}
                              type="button"
                            >
                              この画像を品質確認済みにする
                            </button>
                          ) : null}
                          {job.target_panel_id ? (
                            <button
                              className="button-secondary w-full"
                              disabled={requestingPanelGeneration}
                              onClick={() => void rejectAndRegeneratePanel(job)}
                              type="button"
                            >
                              このコマだけ作り直す（1案）
                            </button>
                          ) : null}
                          {job.quality_review_status === "rejected" ? (
                            <button
                              className="button-secondary w-full"
                              onClick={() => detachRejectedGeneratedAsset(job)}
                              type="button"
                            >
                              不採用画像をCanvasから外す（追加生成なし）
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
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
          {monitorQualityFeedbackEnabled ? (
            <MonitorQualityFeedback
              pageId={page.id}
              pageNumber={page.page_number}
              panels={canvas.panels.map((panel) => ({ id: panel.id, name: panel.name }))}
              projectId={project.id}
              selectedPanelId={selection?.type === "panel" ? selection.id : null}
            />
          ) : null}
          <PanelDesignInspector
            projectId={project.id}
            pageId={page.id}
            panelIds={canvas.panels.map((panel) => panel.id)}
            selectedPanelId={selection?.type === "panel" ? selection.id : null}
          />
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
              containerType: "inline-size",
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
                    <div
                      aria-hidden="true"
                      className="h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                      dangerouslySetInnerHTML={{
                        __html: panelPreviewSvgs.get(panel.id) ?? "",
                      }}
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
            requestImageQualityReview(comparisonJob, "place");
          }}
          onClose={() => setComparisonJobId(null)}
        />
      ) : null}
      {imageQualityReview &&
      imageQualityReviewJob &&
      imageQualityReviewAsset ? (
        <PanelImageQualityReviewDialog
          imageUrl={imageQualityReviewAsset.url}
          onCancel={() => setImageQualityReview(null)}
          onConfirm={() => {
            const request = imageQualityReview;
            const job = imageQualityReviewJob;
            setImageQualityReview(null);
            if (request.action === "place")
              void placeGeneratedAssetAfterReview(job);
            else void approveGeneratedAssetAfterReview(job);
          }}
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
            <div
              aria-label={`${project.title} ${page.page_number}ページのプレビュー`}
              className="mx-auto h-[80vh] max-h-[80vh] w-[80vw] max-w-4xl bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: previewSvg }}
              role="img"
            />
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
