import {
  createPagesPdf,
  mergePagesPdfs,
  type ExportImage,
} from "@mangai/export-core";
import { renderCloudCanvasPng } from "@/lib/cloud-canvas-render";
import {
  exportJobPath,
  exportPageFileName,
  planExportSegment,
  visibleCanvasAssetIds,
} from "./export-plan";
import {
  claimExportJob,
  completeExportSegment,
  createMangaExportRepositoryClient,
  failExportJob,
  listExportSegmentPaths,
  loadExportAssets,
  loadExportSegment,
  loadProjectDpi,
  type MangaExportAdminClient,
} from "./manga-export-repository";
import {
  downloadExportAsset,
  downloadExportObject,
  uploadExportObject,
} from "./manga-export-storage";

export async function processExportSegment(input: {
  workerId: string;
  client?: MangaExportAdminClient;
  leaseSeconds?: number;
}) {
  const client = input.client ?? createMangaExportRepositoryClient();
  const job = await claimExportJob(
    client,
    input.workerId,
    input.leaseSeconds ?? 300,
  );
  if (!job) return { status: "idle" as const };

  try {
    const plan = planExportSegment(job);
    const canvases = await loadExportSegment(
      client,
      job.projectId,
      plan.pageIds,
    );
    const neededIds = new Set(
      canvases.flatMap(({ canvas }) => [...visibleCanvasAssetIds(canvas)]),
    );
    const assets = await loadExportAssets(
      client,
      job.projectId,
      [...neededIds],
    );
    const assetBytes = new Map<
      string,
      { mimeType: string; bytes: Uint8Array }
    >();
    for (const asset of assets) {
      assetBytes.set(asset.id, {
        mimeType: asset.mime_type,
        bytes: await downloadExportAsset(client, asset.storage_path),
      });
    }

    const images: ExportImage[] = [];
    const pagePaths: string[] = [];
    for (const { page, canvas } of canvases) {
      const selected = new Map(
        [...visibleCanvasAssetIds(canvas)].map((id) => [id, assetBytes.get(id)!]),
      );
      const bytes = await renderCloudCanvasPng(canvas, selected);
      const fileName = exportPageFileName(page.page_number);
      const storagePath = exportJobPath(job, `pages/${fileName}`);
      await uploadExportObject(client, storagePath, bytes, "image/png");
      pagePaths.push(storagePath);
      images.push({
        fileName,
        bytes,
        mimeType: "image/png",
        width: page.width,
        height: page.height,
      });
    }

    const dpi = await loadProjectDpi(client, job.projectId);
    const segmentPdf = await createPagesPdf(images, { dpi });
    const segmentPath = exportJobPath(
      job,
      `segments/${String(plan.segmentIndex).padStart(3, "0")}.pdf`,
    );
    await uploadExportObject(
      client,
      segmentPath,
      segmentPdf,
      "application/pdf",
    );

    let outputPath: string | null = null;
    let outputBytes: Uint8Array | null = null;
    if (plan.isFinal) {
      const segmentPaths = await listExportSegmentPaths(client, job.id);
      const pdfs: Uint8Array[] = [];
      for (const storagePath of segmentPaths) {
        pdfs.push(
          await downloadExportObject(client, "cloud-exports", storagePath),
        );
      }
      pdfs.push(segmentPdf);
      outputBytes = await mergePagesPdfs(pdfs);
      outputPath = exportJobPath(job, "manuscript.pdf");
      await uploadExportObject(
        client,
        outputPath,
        outputBytes,
        "application/pdf",
      );
    }

    await completeExportSegment(client, {
      jobId: job.id,
      leaseToken: job.leaseToken,
      segmentIndex: plan.segmentIndex,
      pageCount: plan.pageIds.length,
      pdfStoragePath: segmentPath,
      pageStoragePaths: pagePaths,
      outputStoragePath: outputPath,
      outputByteSize: outputBytes?.byteLength ?? null,
    });
    return {
      status: plan.isFinal
        ? ("completed" as const)
        : ("segment_completed" as const),
      jobId: job.id,
      completedPages: plan.completedPages,
    };
  } catch (error) {
    await failExportJob(
      client,
      job.id,
      job.leaseToken,
      error instanceof Error ? error.message : "export_failed",
    );
    return { status: "failed" as const, jobId: job.id };
  }
}
