import {
  createPagesPdf,
  createImagesZip,
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
  listExportSegments,
  loadExportProject,
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
    const segmentDocument = {
      schemaVersion: 1,
      jobId: job.id,
      projectId: job.projectId,
      segmentIndex: plan.segmentIndex,
      pages: canvases.map(({ page, canvas }) => ({
        id: page.id, pageNumber: page.page_number, revision: page.revision,
        width: page.width, height: page.height, canvas,
      })),
    };
    const segmentBytes = job.format === "pdf"
      ? await createPagesPdf(images, { dpi })
      : new TextEncoder().encode(JSON.stringify(segmentDocument));
    const segmentPath = exportJobPath(job, `segments/${String(plan.segmentIndex).padStart(3, "0")}.${job.format === "pdf" ? "pdf" : "json"}`);
    await uploadExportObject(client, segmentPath, segmentBytes, job.format === "pdf" ? "application/pdf" : "application/json");

    let outputPath: string | null = null;
    let outputBytes: Uint8Array | null = null;
    if (plan.isFinal) {
      if (job.format === "pdf") {
        const pdfs: Uint8Array[] = [];
        for (const storagePath of await listExportSegmentPaths(client, job.id))
          pdfs.push(await downloadExportObject(client, "cloud-exports", storagePath));
        pdfs.push(segmentBytes);
        outputBytes = await mergePagesPdfs(pdfs);
        outputPath = exportJobPath(job, "manuscript.pdf");
        await uploadExportObject(client, outputPath, outputBytes, "application/pdf");
      } else if (job.format === "images") {
        const prior = await listExportSegments(client, job.id);
        const paths = [...prior.flatMap((segment) => segment.page_storage_paths as string[]), ...pagePaths];
        const allImages: ExportImage[] = [];
        for (const path of paths) allImages.push({ fileName: path.split("/").at(-1)!, bytes: await downloadExportObject(client, "cloud-exports", path), mimeType: "image/png", width: 1, height: 1 });
        outputBytes = await createImagesZip(allImages);
        outputPath = exportJobPath(job, "pages.zip");
        await uploadExportObject(client, outputPath, outputBytes, "application/zip");
      } else {
        const prior = await listExportSegments(client, job.id);
        const documents = [];
        for (const segment of prior) documents.push(JSON.parse(new TextDecoder().decode(await downloadExportObject(client, "cloud-exports", segment.pdf_storage_path))));
        documents.push(segmentDocument);
        const project = await loadExportProject(client, job.projectId);
        outputBytes = new TextEncoder().encode(JSON.stringify({
          schemaVersion: 1,
          modeProfile: project.completion_mode_profile,
          project: { id: project.id, title: project.title, description: project.description, readingDirection: project.reading_direction, width: project.width, height: project.height, dpi: project.dpi, revision: project.revision },
          pages: documents.flatMap((document) => document.pages).sort((a, b) => a.pageNumber - b.pageNumber),
          provenance: { exportJobId: job.id, format: "project_json", generatedAt: new Date().toISOString() },
        }));
        outputPath = exportJobPath(job, "project.json");
        await uploadExportObject(client, outputPath, outputBytes, "application/json");
      }
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
