import type { PageCanvas } from "@mangai/canvas-core";
import type {
  CloudAsset,
  CloudAiQuota,
  CloudGenerationJob,
} from "@/lib/cloud-creator-server";
import {
  readApiErrorMessage,
  type CompatibleApiErrorEnvelope,
} from "@/lib/api-error-contract";

async function responseJson<T>(response: Response, fallback: string) {
  const result = (await response.json()) as T & CompatibleApiErrorEnvelope;
  if (!response.ok) throw new Error(readApiErrorMessage(result, fallback));
  return result;
}

export function saveCanvasSnapshot(
  pageId: string,
  expectedRevision: number,
  canvas: PageCanvas,
  signal?: AbortSignal,
) {
  return fetch(`/api/creator/pages/${encodeURIComponent(pageId)}/snapshot`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({ expectedRevision, canvas }),
  });
}

export async function listGenerationJobs(projectId: string, pageId: string) {
  const query = new URLSearchParams({ projectId, pageId });
  return responseJson<CloudGenerationJob[]>(
    await fetch(`/api/creator/generation-jobs?${query}`, {
      cache: "no-store",
    }),
    "生成履歴を取得できませんでした。",
  );
}

export async function getAiQuota() {
  const response = await fetch("/api/creator/ai-quota", {
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as CloudAiQuota | null;
}

export async function uploadProjectAsset(projectId: string, file: File) {
  const formData = new FormData();
  formData.set("projectId", projectId);
  formData.set("file", file);
  return responseJson<CloudAsset>(
    await fetch("/api/creator/assets", {
      method: "POST",
      body: formData,
    }),
    "Assetを追加できませんでした。",
  );
}

export async function getAssetUrl(assetId: string) {
  const query = new URLSearchParams({ id: assetId });
  return responseJson<{ url: string }>(
    await fetch(`/api/creator/assets?${query}`),
    "Assetを表示できませんでした。",
  );
}

export async function listProjectAssets(projectId: string) {
  const query = new URLSearchParams({ projectId });
  return responseJson<CloudAsset[]>(
    await fetch(`/api/creator/assets?${query}`, { cache: "no-store" }),
    "生成Assetを取得できませんでした。",
  );
}

export async function createGenerationJob(body: {
  projectId: string;
  pageId: string;
  idempotencyKey: string;
  generation: {
    kind: "image" | "text";
    jobType: string;
    prompt: string;
    negativePrompt: string;
    width?: number;
    height?: number;
  };
}) {
  return responseJson<{ id: string }>(
    await fetch("/api/creator/generation-jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Cloud AI Jobを登録できませんでした。",
  );
}

export async function createStoryboardPanelGenerationJob(
  body: import("@/modules/manga/contracts/panel-generation").CloudPanelImageGenerationRequestInput,
) {
  return responseJson<{
    id: string;
    jobs: Array<{ id: string; candidateNumber: number }>;
    panelId: string;
    pageNumber: number;
    panelNumber: number;
    requestedCandidateCount: number;
    partial: boolean;
  }>(
    await fetch("/api/creator/storyboard-panel-generation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    "ネームから画像生成を開始できませんでした。",
  );
}

export async function cancelGeneration(jobId: string) {
  return responseJson<Record<string, never>>(
    await fetch(`/api/creator/generation-jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    }),
    "Jobをキャンセルできませんでした。",
  );
}

export async function recordMangaQualityEvent(body: {
  event: "displayed" | "selected" | "rejected";
  generationJobId: string;
  rejectedReason?: string;
}) {
  const response = await fetch("/api/creator/manga-quality-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("品質ログを保存できませんでした。");
}
