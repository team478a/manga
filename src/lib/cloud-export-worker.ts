import { createPagesPdf, mergePagesPdfs, type ExportImage } from "@mangai/export-core";
import { createAdminClient } from "./supabase/admin";
import { normalizeCloudCanvas } from "@/modules/cloud-creator/canvas/canvas-normalizer";
import { renderCloudCanvasPng } from "./cloud-canvas-render";
import { CLOUD_ASSET_BUCKET } from "./cloud-creator-contract";

type AdminClient = ReturnType<typeof createAdminClient>;
type ClaimedExportJob = {
  id: string;
  project_id: string;
  created_by_profile_id: string;
  page_ids: string[];
  total_pages: number;
  completed_pages: number;
  segment_size: number;
  lease_token: string;
};

function canvasAssetIds(canvas: ReturnType<typeof normalizeCloudCanvas>) {
  const ids = new Set<string>();
  for (const panel of canvas.panels.filter((item) => item.visible)) {
    const layers = canvas.panelLayers.filter((layer) => layer.panelId === panel.id && layer.visible && layer.assetId);
    if (layers.some((layer) => layer.type !== "flattened_legacy")) {
      for (const layer of layers.filter((item) => item.type !== "flattened_legacy")) if (layer.assetId) ids.add(layer.assetId);
    } else if (panel.imageAssetId) ids.add(panel.imageAssetId);
  }
  return ids;
}

async function download(client: AdminClient, bucket: string, storagePath: string) {
  const result = await client.storage.from(bucket).download(storagePath);
  if (result.error || !result.data) throw new Error("export_storage_read_failed");
  return new Uint8Array(await result.data.arrayBuffer());
}

async function upload(client: AdminClient, path: string, bytes: Uint8Array, contentType: string) {
  const result = await client.storage.from("cloud-exports").upload(path, bytes, { contentType, upsert: true });
  if (result.error) throw new Error("export_storage_write_failed");
}

export async function processNextCloudExportJob(input: { workerId: string; client?: AdminClient; leaseSeconds?: number }) {
  const client = input.client ?? createAdminClient();
  const claim = await client.rpc("claim_cloud_export_job", {
    p_worker_id: input.workerId,
    p_lease_seconds: input.leaseSeconds ?? 300,
  });
  if (claim.error) throw new Error("export_job_claim_failed");
  const job = claim.data?.[0] as ClaimedExportJob | undefined;
  if (!job) return { status: "idle" as const };
  try {
    const start = job.completed_pages;
    const pageIds = job.page_ids.slice(start, start + job.segment_size);
    const pagesResult = await client
      .from("cloud_pages")
      .select("id,page_number,width,height,background_color,revision,project_id,episode_id,order_index")
      .in("id", pageIds)
      .eq("project_id", job.project_id);
    if (pagesResult.error || pagesResult.data?.length !== pageIds.length) throw new Error("export_pages_missing");
    const snapshotsResult = await client
      .from("cloud_canvas_snapshots")
      .select("page_id,revision,canvas")
      .in("page_id", pageIds)
      .order("revision", { ascending: false });
    if (snapshotsResult.error) throw new Error("export_snapshots_missing");
    const latest = new Map<string, unknown>();
    for (const row of snapshotsResult.data ?? []) if (!latest.has(row.page_id)) latest.set(row.page_id, row.canvas);
    const orderedPages = [...(pagesResult.data ?? [])].sort((a, b) => pageIds.indexOf(a.id) - pageIds.indexOf(b.id));
    const canvases = orderedPages.map((page) => ({ page, canvas: normalizeCloudCanvas(page, latest.get(page.id)) }));
    const neededIds = new Set(canvases.flatMap(({ canvas }) => [...canvasAssetIds(canvas)]));
    const assetsResult = neededIds.size
      ? await client.from("cloud_assets").select("id,storage_path,mime_type").eq("project_id", job.project_id).is("deleted_at", null).in("id", [...neededIds])
      : { data: [], error: null };
    if (assetsResult.error || assetsResult.data?.length !== neededIds.size) throw new Error("export_assets_missing");
    const assetBytes = new Map<string, { mimeType: string; bytes: Uint8Array }>();
    for (const asset of assetsResult.data ?? []) assetBytes.set(asset.id, { mimeType: asset.mime_type, bytes: await download(client, CLOUD_ASSET_BUCKET, asset.storage_path) });
    const images: ExportImage[] = [];
    const pagePaths: string[] = [];
    for (const { page, canvas } of canvases) {
      const selected = new Map([...canvasAssetIds(canvas)].map((id) => [id, assetBytes.get(id)!]));
      const bytes = await renderCloudCanvasPng(canvas, selected);
      const fileName = `${String(page.page_number).padStart(3, "0")}.png`;
      const storagePath = `${job.created_by_profile_id}/${job.project_id}/${job.id}/pages/${fileName}`;
      await upload(client, storagePath, bytes, "image/png");
      pagePaths.push(storagePath);
      images.push({ fileName, bytes, mimeType: "image/png", width: page.width, height: page.height });
    }
    const projectResult = await client.from("cloud_projects").select("dpi").eq("id", job.project_id).single();
    if (projectResult.error || !projectResult.data) throw new Error("export_project_missing");
    const segmentIndex = Math.floor(start / job.segment_size);
    const segmentPdf = await createPagesPdf(images, { dpi: projectResult.data.dpi });
    const segmentPath = `${job.created_by_profile_id}/${job.project_id}/${job.id}/segments/${String(segmentIndex).padStart(3, "0")}.pdf`;
    await upload(client, segmentPath, segmentPdf, "application/pdf");
    const completed = start + pageIds.length;
    let outputPath: string | null = null;
    let outputBytes: Uint8Array | null = null;
    if (completed === job.total_pages) {
      const segmentsResult = await client.from("cloud_export_segments").select("segment_index,pdf_storage_path").eq("job_id", job.id).order("segment_index");
      if (segmentsResult.error) throw new Error("export_segments_missing");
      const pdfs = [] as Uint8Array[];
      for (const segment of segmentsResult.data ?? []) pdfs.push(await download(client, "cloud-exports", segment.pdf_storage_path));
      pdfs.push(segmentPdf);
      outputBytes = await mergePagesPdfs(pdfs);
      outputPath = `${job.created_by_profile_id}/${job.project_id}/${job.id}/manuscript.pdf`;
      await upload(client, outputPath, outputBytes, "application/pdf");
    }
    const finish = await client.rpc("complete_cloud_export_segment", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_segment_index: segmentIndex,
      p_page_count: pageIds.length,
      p_pdf_storage_path: segmentPath,
      p_page_storage_paths: pagePaths,
      p_output_storage_path: outputPath,
      p_output_byte_size: outputBytes?.byteLength ?? null,
    });
    if (finish.error) throw new Error("export_job_finish_failed");
    return { status: completed === job.total_pages ? "completed" as const : "segment_completed" as const, jobId: job.id, completedPages: completed };
  } catch (error) {
    await client.rpc("fail_cloud_export_job", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_error_code: error instanceof Error ? error.message : "export_failed",
      p_retryable: true,
    });
    return { status: "failed" as const, jobId: job.id };
  }
}
