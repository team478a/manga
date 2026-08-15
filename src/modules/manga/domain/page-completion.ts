import type { Balloon, PageCanvas, Panel } from "@mangai/canvas-core";

export type MangaPageCompletionStatus =
  | "incomplete"
  | "generating"
  | "review_required"
  | "complete";

export type MangaPageCompletionBlockerCode =
  | "PANEL_IMAGE_MISSING"
  | "IMAGE_JOB_PENDING"
  | "IMAGE_JOB_FAILED"
  | "DIALOGUE_MISSING"
  | "BALLOON_TEXT_EMPTY"
  | "CANVAS_NOT_SAVED"
  | "REVISION_CONFLICT"
  | "ASSET_UNAVAILABLE"
  | "PNG_RENDER_FAILED"
  | "PAGE_DIMENSION_INVALID"
  | "IMAGE_QUALITY_REVIEW_REQUIRED"
  | "MANUAL_REVIEW_REQUIRED";

export type MangaPageCompletionBlocker = {
  code: MangaPageCompletionBlockerCode;
  message: string;
  pageId: string;
  panelId?: string;
  balloonId?: string;
  generationJobId?: string;
};

export type RequiredPageDialogue = {
  panelIndex: number;
  text: string;
};

export type PageImageGenerationState = {
  id: string;
  pageId: string;
  panelId: string | null;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  outputAssetId: string | null;
  candidateOutputAssetIds?: string[];
  candidateJobIds?: string[];
};

export type MangaPageCompletionResult = {
  complete: boolean;
  status: MangaPageCompletionStatus;
  blockers: MangaPageCompletionBlocker[];
  panelImageCount: number;
  requiredPanelImageCount: number;
  dialogueCount: number;
  placedDialogueCount: number;
  pendingGenerationCount: number;
  failedGenerationCount: number;
  savedRevision: number | null;
  currentRevision: number | null;
};

function insidePanel(
  value: Pick<Balloon, "x" | "y" | "width" | "height">,
  panel: Panel,
) {
  const x = value.x + value.width / 2;
  const y = value.y + value.height / 2;
  return x >= panel.x && x <= panel.x + panel.width && y >= panel.y && y <= panel.y + panel.height;
}

function readingOrder(a: Balloon, b: Balloon) {
  const tolerance = Math.max(24, Math.min(a.height, b.height) * 0.45);
  return Math.abs(a.y - b.y) > tolerance ? a.y - b.y : b.x - a.x;
}

function visiblePanelAssetIds(canvas: PageCanvas, panel: Panel) {
  const panelLayers = canvas.panelLayers.filter((layer) => layer.panelId === panel.id);
  const separated = panelLayers.filter((layer) => layer.type !== "flattened_legacy");
  if (separated.length)
    return separated
      .filter((layer) => layer.visible && layer.assetId)
      .map((layer) => layer.assetId as string);
  return panel.imageAssetId ? [panel.imageAssetId] : [];
}

export function evaluateMangaPageCompletion(input: {
  pageId: string;
  pageWidth: number;
  pageHeight: number;
  canvas: PageCanvas | null;
  savedRevision: number | null;
  currentRevision: number | null;
  hasUnsavedChanges?: boolean;
  requiredDialogues: RequiredPageDialogue[];
  imageJobs: PageImageGenerationState[];
  availableAssetIds: ReadonlySet<string>;
  reviewedGenerationJobIds?: ReadonlySet<string>;
  reviewedGenerationAssetIds?: ReadonlySet<string>;
  rejectedGenerationJobIds?: ReadonlySet<string>;
  pngRenderSucceeded: boolean;
  manualReviewRequired: boolean;
}): MangaPageCompletionResult {
  const blockers: MangaPageCompletionBlocker[] = [];
  const add = (blocker: MangaPageCompletionBlocker) => blockers.push(blocker);
  const canvas = input.canvas;
  const pageJobs = input.imageJobs.filter((job) => job.pageId === input.pageId);
  const pendingJobs = pageJobs.filter((job) => job.status === "queued" || job.status === "running");
  const failedJobs = pageJobs.filter(
    (job) => job.status === "failed" || job.status === "canceled" || (job.status === "completed" && !job.outputAssetId),
  );

  for (const job of pendingJobs)
    add({ code: "IMAGE_JOB_PENDING", message: "画像生成が完了していません。", pageId: input.pageId, panelId: job.panelId ?? undefined, generationJobId: job.id });
  for (const job of failedJobs)
    add({ code: "IMAGE_JOB_FAILED", message: "画像生成に失敗したコマがあります。", pageId: input.pageId, panelId: job.panelId ?? undefined, generationJobId: job.id });

  if (!canvas || input.savedRevision == null) {
    add({ code: "CANVAS_NOT_SAVED", message: "ページを一度保存してください。", pageId: input.pageId });
  }
  if (
    input.hasUnsavedChanges ||
    input.savedRevision !== input.currentRevision ||
    (canvas && canvas.pageId !== input.pageId)
  ) {
    add({ code: "REVISION_CONFLICT", message: "保存済みページと最新revisionが一致していません。", pageId: input.pageId });
  }
  if (
    !canvas ||
    canvas.width !== input.pageWidth ||
    canvas.height !== input.pageHeight ||
    input.pageWidth < 100 ||
    input.pageHeight < 100
  ) {
    add({ code: "PAGE_DIMENSION_INVALID", message: "ページ寸法が保存設定と一致していません。", pageId: input.pageId });
  }

  let panelImageCount = 0;
  let placedDialogueCount = 0;
  if (canvas) {
    const assetIdsByPanel = new Map<string, string[]>();
    const firstPanelByAsset = new Map<string, string>();
    for (const panel of canvas.panels.filter((item) => item.visible)) {
      const assetIds = visiblePanelAssetIds(canvas, panel);
      assetIdsByPanel.set(panel.id, assetIds);
      if (!assetIds.length) {
        add({ code: "PANEL_IMAGE_MISSING", message: `${panel.name}に画像が配置されていません。`, pageId: input.pageId, panelId: panel.id });
        continue;
      }
      const unavailable = assetIds.find((id) => !input.availableAssetIds.has(id));
      if (unavailable) {
        add({ code: "ASSET_UNAVAILABLE", message: `${panel.name}の画像素材を読み込めません。`, pageId: input.pageId, panelId: panel.id });
        continue;
      }
      panelImageCount += 1;
      for (const layer of canvas.panelLayers.filter(
        (item) => item.panelId === panel.id && item.visible && item.sourceJobId,
      )) {
        const reviewedByJob = input.reviewedGenerationJobIds?.has(
          layer.sourceJobId!,
        );
        const reviewedByAsset = Boolean(
          layer.assetId &&
            input.reviewedGenerationAssetIds?.has(layer.assetId),
        );
        if (!reviewedByJob && !reviewedByAsset)
          add({
            code: "IMAGE_QUALITY_REVIEW_REQUIRED",
            message: `${panel.name}の生成画像を目視確認してください。`,
            pageId: input.pageId,
            panelId: panel.id,
            generationJobId: layer.sourceJobId!,
          });
      }
      for (const assetId of assetIds) {
        const existingPanelId = firstPanelByAsset.get(assetId);
        if (existingPanelId && existingPanelId !== panel.id)
          add({ code: "MANUAL_REVIEW_REQUIRED", message: "同じ画像素材が複数のコマに配置されています。", pageId: input.pageId, panelId: panel.id });
        else firstPanelByAsset.set(assetId, panel.id);
      }
    }
    for (const job of pageJobs.filter((item) => item.status === "completed" && item.panelId)) {
      const candidateIds = job.candidateOutputAssetIds?.length
        ? job.candidateOutputAssetIds
        : job.outputAssetId ? [job.outputAssetId] : [];
      const candidateJobIds = job.candidateJobIds?.length
        ? job.candidateJobIds
        : [job.id];
      const allCandidatesRejected = candidateJobIds.every((id) =>
        input.rejectedGenerationJobIds?.has(id),
      );
      if (
        candidateIds.length &&
        !allCandidatesRejected &&
        !candidateIds.some((id) => assetIdsByPanel.get(job.panelId!)?.includes(id))
      )
        add({ code: "PANEL_IMAGE_MISSING", message: "生成済み画像が対象コマへ配置されていません。", pageId: input.pageId, panelId: job.panelId!, generationJobId: job.id });
    }

    const dialoguesByPanel = new Map<number, RequiredPageDialogue[]>();
    for (const dialogue of input.requiredDialogues) {
      const values = dialoguesByPanel.get(dialogue.panelIndex) ?? [];
      values.push(dialogue);
      dialoguesByPanel.set(dialogue.panelIndex, values);
    }
    for (const [panelIndex, dialogues] of dialoguesByPanel) {
      const panel = canvas.panels[panelIndex];
      const balloons = panel
        ? canvas.balloons.filter((balloon) => balloon.visible && insidePanel(balloon, panel)).sort(readingOrder)
        : [];
      dialogues.forEach((dialogue, dialogueIndex) => {
        const balloon = balloons[dialogueIndex];
        const attached = balloon
          ? canvas.textObjects.filter((text) => text.visible && text.parentBalloonId === balloon.id)
          : [];
        if (balloon && !attached.some((text) => text.text.trim()))
          add({ code: "BALLOON_TEXT_EMPTY", message: `${balloon.name}にセリフがありません。`, pageId: input.pageId, panelId: panel?.id, balloonId: balloon.id });
        if (!balloon || !attached.some((text) => text.text.trim() === dialogue.text.trim()))
          add({ code: "DIALOGUE_MISSING", message: `${panel?.name ?? `${panelIndex + 1}コマ目`}の必須セリフが配置されていません。`, pageId: input.pageId, panelId: panel?.id, balloonId: balloon?.id });
        else placedDialogueCount += 1;
      });
    }
  }

  if (!input.pngRenderSucceeded)
    add({ code: "PNG_RENDER_FAILED", message: "ページ画像を作成できませんでした。", pageId: input.pageId });
  if (input.manualReviewRequired)
    add({ code: "MANUAL_REVIEW_REQUIRED", message: "自動配置結果に確認が必要です。", pageId: input.pageId });

  const status: MangaPageCompletionStatus = pendingJobs.length
    ? "generating"
    : blockers.some(
        (blocker) =>
          blocker.code !== "MANUAL_REVIEW_REQUIRED" &&
          blocker.code !== "IMAGE_QUALITY_REVIEW_REQUIRED",
      )
      ? "incomplete"
      : blockers.length
        ? "review_required"
        : "complete";
  return {
    complete: status === "complete",
    status,
    blockers,
    panelImageCount,
    requiredPanelImageCount: canvas?.panels.filter((item) => item.visible).length ?? 0,
    dialogueCount: input.requiredDialogues.length,
    placedDialogueCount,
    pendingGenerationCount: pendingJobs.length,
    failedGenerationCount: failedJobs.length,
    savedRevision: input.savedRevision,
    currentRevision: input.currentRevision,
  };
}

export function summarizeMangaProjectCompletion(
  pages: Array<MangaPageCompletionResult & { pageId: string; pageNumber: number }>,
) {
  const count = (status: MangaPageCompletionStatus) => pages.filter((page) => page.status === status).length;
  const completedPages = count("complete");
  return {
    complete: pages.length > 0 && completedPages === pages.length,
    totalPages: pages.length,
    completedPages,
    generatingPages: count("generating"),
    incompletePages: count("incomplete"),
    reviewRequiredPages: count("review_required"),
    failedPages: pages.filter((page) => page.failedGenerationCount > 0).length,
    completionPercent: pages.length ? Math.round((completedPages / pages.length) * 100) : 0,
  };
}
