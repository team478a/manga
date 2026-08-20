import crypto from "node:crypto";
import sharp from "sharp";
import { pageCanvasSchema, type PageCanvas } from "@mangai/canvas-core";
import { renderCloudCanvasPng } from "@/lib/cloud-canvas-render";
import { cloudStoryboardResultSchema } from "@/lib/cloud-storyboard";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import {
  evaluateMangaPageCompletion,
  hasUnresolvedPanelAdoptionReview,
  summarizeMangaProjectCompletion,
  visibleReviewedPanelIds,
  type MangaPageCompletionResult,
  type PageImageGenerationState,
  type RequiredPageDialogue,
} from "../../manga/domain/page-completion";
import { cloudCreatorContext, type CloudCreatorClient } from "../auth-context";
import { getCloudProjectWorkspace } from "./project-service";
import { visibleCanvasAssetIds } from "../export/export-plan";

export type CloudPageCompletion = MangaPageCompletionResult & {
  pageId: string;
  pageNumber: number;
  width: number;
  height: number;
};

type SnapshotRow = { page_id: string; revision: number; canvas: unknown };
type AssetRow = {
  id: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
};

function latestImageJobs(rows: Array<Record<string, unknown>>) {
  const latestOperation = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const payload = row.input && typeof row.input === "object" ? row.input as Record<string, unknown> : {};
    const panelId = typeof payload.targetPanelId === "string" ? payload.targetPanelId : null;
    if (!row.page_id || !panelId) continue;
    const operation = String(row.idempotency_key ?? row.created_at).replace(/:candidate:\d+$/, "");
    const target = `${row.page_id}:${panelId}`;
    if (latestOperation.has(target)) {
      const current = latestOperation.get(target)!;
      if (String(current[0]?.idempotency_key ?? "").replace(/:candidate:\d+$/, "") === operation)
        current.push(row);
      continue;
    }
    latestOperation.set(target, [row]);
  }
  const jobs: PageImageGenerationState[] = [];
  for (const rowsForTarget of latestOperation.values()) {
    const first = rowsForTarget[0];
    const payload = first.input as Record<string, unknown>;
    const statuses = rowsForTarget.map((row) => String(row.status));
    const completed = rowsForTarget.find((row) => row.status === "completed" && row.output_asset_id);
    const status = statuses.includes("running")
      ? "running"
      : statuses.includes("queued")
        ? "queued"
        : completed
          ? "completed"
          : statuses.includes("failed")
            ? "failed"
            : "canceled";
    jobs.push({
      id: String(first.id),
      pageId: String(first.page_id),
      panelId: String(payload.targetPanelId),
      status,
      outputAssetId: completed ? String(completed.output_asset_id) : null,
      candidateOutputAssetIds: rowsForTarget.flatMap((row) =>
        row.status === "completed" && row.output_asset_id ? [String(row.output_asset_id)] : [],
      ),
      candidateJobIds: rowsForTarget.map((row) => String(row.id)),
    });
  }
  return jobs;
}

async function loadRequiredDialogues(
  supabase: CloudCreatorClient,
  projectId: string,
) {
  const materialization = await supabase
    .from("cloud_story_storyboard_projects")
    .select("storyboard_version_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (materialization.error || !materialization.data)
    throw new ValidationError("採用済みStoryboardの必須セリフを確認できませんでした。");
  const storyboardResult = await supabase
    .from("cloud_story_storyboard_versions")
    .select("result")
    .eq("id", materialization.data.storyboard_version_id)
    .maybeSingle();
  if (storyboardResult.error || !storyboardResult.data)
    throw new ValidationError("採用済みStoryboardの必須セリフを確認できませんでした。");
  const parsed = cloudStoryboardResultSchema.safeParse(storyboardResult.data.result);
  if (!parsed.success)
    throw new ValidationError("採用済みStoryboardの形式を確認できませんでした。");
  return new Map(parsed.data.pages.map((page) => [
    page.pageNumber,
    page.panels.flatMap((panel, panelIndex) => panel.dialogue.map((dialogue) => ({
      panelIndex,
      text: dialogue.text,
    }))),
  ]));
}

async function loadAssetBytes(
  supabase: CloudCreatorClient,
  assets: AssetRow[],
  requiredIds: Set<string>,
) {
  const rows = new Map(assets.map((asset) => [asset.id, asset]));
  const bytes = new Map<string, { mimeType: string; bytes: Uint8Array }>();
  const ids = [...requiredIds];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(3, ids.length) }, async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const asset = rows.get(id);
      if (!asset) continue;
      const downloaded = await supabase.storage.from("cloud-assets").download(asset.storage_path);
      if (downloaded.error || !downloaded.data) continue;
      const value = new Uint8Array(await downloaded.data.arrayBuffer());
      if (
        value.byteLength !== Number(asset.byte_size) ||
        crypto.createHash("sha256").update(value).digest("hex") !== asset.sha256
      ) continue;
      bytes.set(id, { mimeType: asset.mime_type, bytes: value });
    }
  }));
  return bytes;
}

async function inspectCloudPages(projectId: string, onlyPageId?: string) {
  const { supabase } = await cloudCreatorContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  const pages = workspace.pages.filter((page) => !onlyPageId || page.id === onlyPageId);
  if (onlyPageId && !pages.length) throw new ValidationError("対象ページが見つかりません。");
  if (!pages.length) return [];
  const pageIds = pages.map((page) => page.id);
  const [snapshots, assets, jobs, placements, productionRows, requiredByPage] = await Promise.all([
    supabase.from("cloud_canvas_snapshots").select("page_id,revision,canvas").in("page_id", pageIds).order("revision", { ascending: false }),
    supabase.from("cloud_assets").select("id,storage_path,mime_type,byte_size,sha256").eq("project_id", projectId).is("deleted_at", null),
    supabase.from("cloud_generation_jobs").select("id,page_id,status,output_asset_id,created_at,input,idempotency_key").eq("project_id", projectId).eq("kind", "image").in("page_id", pageIds).order("created_at", { ascending: false }).limit(2000),
    supabase.from("cloud_page_dialogue_placements").select("page_id,status").eq("project_id", projectId),
    supabase.from("cloud_pages").select("id,production_status").eq("project_id", projectId).in("id", pageIds).is("deleted_at", null),
    loadRequiredDialogues(supabase, projectId),
  ]);
  if (snapshots.error || assets.error || jobs.error || placements.error || productionRows.error)
    throw new DomainError("INTERNAL_ERROR", "ページの完成状態を確認できませんでした。", {
      cause: snapshots.error ?? assets.error ?? jobs.error ?? placements.error ?? productionRows.error,
    });
  const latest = new Map<string, SnapshotRow>();
  for (const row of snapshots.data ?? []) if (!latest.has(row.page_id)) latest.set(row.page_id, row as SnapshotRow);
  const canvases = new Map<string, PageCanvas>();
  const requiredAssetIds = new Set<string>();
  for (const page of pages) {
    const parsed = pageCanvasSchema.safeParse(latest.get(page.id)?.canvas);
    if (!parsed.success) continue;
    canvases.set(page.id, parsed.data);
    for (const id of visibleCanvasAssetIds(parsed.data)) requiredAssetIds.add(id);
  }
  const assetBytes = await loadAssetBytes(supabase, (assets.data ?? []) as AssetRow[], requiredAssetIds);
  const imageJobRows = (jobs.data ?? []) as Array<Record<string, unknown>>;
  const currentJobs = latestImageJobs(imageJobRows);
  const currentJobIds = currentJobs.flatMap((job) => job.candidateJobIds ?? [job.id]);
  const visibleGenerationJobIds = [...new Set(
    [...canvases.values()].flatMap((canvas) =>
      canvas.panelLayers.flatMap((layer) =>
        layer.visible && layer.sourceJobId ? [layer.sourceJobId] : [],
      ),
    ),
  )];
  const visibleGenerationAssetJobIds = imageJobRows.flatMap((row) =>
    row.output_asset_id && requiredAssetIds.has(String(row.output_asset_id))
      ? [String(row.id)]
      : [],
  );
  const qualityJobIds = [...new Set([
    ...currentJobIds,
    ...visibleGenerationJobIds,
    ...visibleGenerationAssetJobIds,
  ])];
  const [adoptions, qualityEvents] = await Promise.all([
    currentJobIds.length
      ? supabase.from("cloud_generation_panel_adoptions").select("generation_job_id,status").in("generation_job_id", currentJobIds)
      : Promise.resolve({ data: [], error: null }),
    qualityJobIds.length
      ? supabase.from("cloud_manga_quality_logs").select("generation_job_id,event_type,created_at").in("generation_job_id", qualityJobIds).in("event_type", ["selected", "rejected"]).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (adoptions.error || qualityEvents.error)
    throw new DomainError("INTERNAL_ERROR", "画像の品質確認状態を取得できませんでした。", {
      cause: adoptions.error ?? qualityEvents.error,
    });
  const adoptionStatus = new Map((adoptions.data ?? []).map((row) => [row.generation_job_id, row.status]));
  const latestQualityEvent = new Map<string, string>();
  for (const row of qualityEvents.data ?? [])
    if (!latestQualityEvent.has(row.generation_job_id))
      latestQualityEvent.set(row.generation_job_id, row.event_type);
  const reviewedGenerationJobIds = new Set(
    [...latestQualityEvent.entries()]
      .filter(([, event]) => event === "selected")
      .map(([jobId]) => jobId),
  );
  const reviewedGenerationAssetIds = new Set(
    imageJobRows.flatMap((row) =>
      latestQualityEvent.get(String(row.id)) === "selected" &&
      row.output_asset_id
        ? [String(row.output_asset_id)]
        : [],
    ),
  );
  const rejectedGenerationJobIds = new Set(
    [...latestQualityEvent.entries()]
      .filter(([, event]) => event === "rejected")
      .map(([jobId]) => jobId),
  );
  const reviewedVisiblePanelIdsByPage = new Map<string, Set<string>>();
  for (const [pageId, canvas] of canvases) {
    reviewedVisiblePanelIdsByPage.set(pageId, visibleReviewedPanelIds({
      canvas,
      reviewedGenerationJobIds,
      reviewedGenerationAssetIds,
    }));
  }
  const placementByPage = new Map((placements.data ?? []).map((row) => [row.page_id, row.status]));
  const productionByPage = new Map((productionRows.data ?? []).map((row) => [row.id, row.production_status]));
  const results: Array<CloudPageCompletion & { png: Uint8Array | null }> = [];
  for (const page of pages.sort((a, b) => a.page_number - b.page_number)) {
    const snapshot = latest.get(page.id);
    const canvas = canvases.get(page.id) ?? null;
    let png: Uint8Array | null = null;
    let pngRenderSucceeded = false;
    if (canvas) try {
      const selected = new Map([...visibleCanvasAssetIds(canvas)].flatMap((id) => {
        const asset = assetBytes.get(id);
        return asset ? [[id, asset] as const] : [];
      }));
      png = await renderCloudCanvasPng(canvas, selected);
      const metadata = await sharp(Buffer.from(png)).metadata();
      pngRenderSucceeded = metadata.width === page.width && metadata.height === page.height;
    } catch { png = null; }
    const completion = evaluateMangaPageCompletion({
      pageId: page.id,
      pageWidth: page.width,
      pageHeight: page.height,
      canvas,
      savedRevision: snapshot ? Number(snapshot.revision) : null,
      currentRevision: Number(page.revision),
      requiredDialogues: requiredByPage.get(page.page_number) ?? [],
      imageJobs: currentJobs,
      availableAssetIds: new Set(assetBytes.keys()),
      reviewedGenerationJobIds,
      reviewedGenerationAssetIds,
      rejectedGenerationJobIds,
      pngRenderSucceeded,
      manualReviewRequired:
        placementByPage.get(page.id) === "review_required" ||
        placementByPage.get(page.id) === "placement_failed" ||
        productionByPage.get(page.id) === "revision_required" ||
        currentJobs.some((job) =>
          job.pageId === page.id &&
          hasUnresolvedPanelAdoptionReview({
            candidateJobIds: job.candidateJobIds ?? [job.id],
            adoptionStatusByJobId: adoptionStatus,
            reviewedGenerationJobIds,
            rejectedGenerationJobIds,
            hasReviewedVisibleImage: Boolean(
              job.panelId &&
              reviewedVisiblePanelIdsByPage.get(page.id)?.has(job.panelId),
            ),
          }),
        ),
    });
    results.push({ ...completion, pageId: page.id, pageNumber: page.page_number, width: page.width, height: page.height, png });
  }
  return results;
}

export async function getCloudProjectCompletion(projectId: string) {
  const inspected = await inspectCloudPages(projectId);
  const pages = inspected.map(({ png: _png, ...page }) => page);
  return { pages, ...summarizeMangaProjectCompletion(pages) };
}

export async function getCloudPageCompletion(projectId: string, pageId: string) {
  const [page] = await inspectCloudPages(projectId, pageId);
  if (!page) throw new ValidationError("対象ページが見つかりません。");
  const { png: _png, ...completion } = page;
  return completion;
}

export async function renderCloudPageCompletionPng(projectId: string, pageId: string) {
  const [page] = await inspectCloudPages(projectId, pageId);
  if (!page?.png) throw new ValidationError("ページ画像を作成できませんでした。");
  return { bytes: page.png, completion: page };
}

export async function assertCloudProjectComplete(projectId: string) {
  const result = await getCloudProjectCompletion(projectId);
  if (!result.complete)
    throw new ValidationError(result.pages.flatMap((page) => page.blockers).slice(0, 3).map((item) => item.message).join(" ") || "すべてのページを完成させてください。");
  return result;
}
