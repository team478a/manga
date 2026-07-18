import crypto from "node:crypto";
import {
  createImagesZip,
  createPagesPdf,
  createProjectManifest,
  createSalesPackageZip,
  createSalesTextDraft,
  type ExportImage,
  type SalesPackageManifest,
} from "@mangai/export-core";
import { CONTENT_POLICY_VERSION } from "@mangai/shared";
import { getCloudProjectExportBundle } from "@/lib/cloud-creator-server";
import { renderCloudCanvasPng } from "@/lib/cloud-canvas-render";

function sha256(bytes: Uint8Array) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function exportImages(projectId: string) {
  const bundle = await getCloudProjectExportBundle(projectId);
  const assets = new Map(
    bundle.assets.map((asset) => [
      asset.id,
      { mimeType: asset.mime_type, bytes: asset.bytes },
    ]),
  );
  const images: ExportImage[] = [];
  for (const page of bundle.pages.sort(
    (a, b) => a.page_number - b.page_number,
  )) {
    images.push({
      fileName: `${String(page.page_number).padStart(3, "0")}.png`,
      bytes: await renderCloudCanvasPng(page.canvas, assets),
      mimeType: "image/png",
      width: page.width,
      height: page.height,
    });
  }
  return { bundle, images };
}

export async function createCloudProjectExport(
  projectId: string,
  format: "pdf" | "images" | "package",
) {
  const { bundle, images } = await exportImages(projectId);
  if (format === "pdf") {
    return {
      bytes: await createPagesPdf(images, { dpi: bundle.project.dpi }),
      mimeType: "application/pdf",
      extension: "pdf",
    };
  }
  const imageZip = await createImagesZip(images);
  if (format === "images")
    return {
      bytes: imageZip,
      mimeType: "application/zip",
      extension: "zip",
    };
  const pdf = await createPagesPdf(images, { dpi: bundle.project.dpi });
  const salesText = createSalesTextDraft({
    title: bundle.project.title,
    ageRating: bundle.project.age_rating,
  });
  const projectInfo = createProjectManifest({
    project: bundle.project,
    episodes: bundle.episodes,
    pages: bundle.pages.map(({ canvas: _canvas, ...page }) => page),
  });
  const description = new TextEncoder().encode(salesText.description);
  const socialPost = new TextEncoder().encode(salesText.snsPost);
  const coverIndex = Math.max(
    0,
    bundle.pages.findIndex((page) => page.id === bundle.project.cover_page_id),
  );
  const cover = images[coverIndex]?.bytes;
  const files = [
    {
      role: "product_pdf" as const,
      path: "product/main.pdf",
      mimeType: "application/pdf",
      bytes: pdf,
    },
    {
      role: "page_images_zip" as const,
      path: "product/pages.zip",
      mimeType: "application/zip",
      bytes: imageZip,
    },
    ...(cover
      ? [
          {
            role: "cover" as const,
            path: "product/cover.png",
            mimeType: "image/png",
            bytes: cover,
          },
        ]
      : []),
    {
      role: "project_info" as const,
      path: "project.json",
      mimeType: "application/json",
      bytes: projectInfo,
    },
    {
      role: "description" as const,
      path: "sales/description.txt",
      mimeType: "text/plain",
      bytes: description,
    },
    {
      role: "social_post" as const,
      path: "sales/social.txt",
      mimeType: "text/plain",
      bytes: socialPost,
    },
  ];
  const manifest: SalesPackageManifest = {
    format: "mangai.sales-package",
    version: 2,
    createdAt: new Date().toISOString(),
    createdBySurface: "cloud",
    policyVersion: CONTENT_POLICY_VERSION,
    work: {
      sourceProjectId: bundle.project.id,
      title: bundle.project.title,
      subtitle: "",
      description: bundle.project.description,
      genre: "漫画",
      ageRating: bundle.project.age_rating,
      contentClass: "general",
      readingDirection: bundle.project.reading_direction,
      width: bundle.project.width,
      height: bundle.project.height,
      dpi: bundle.project.dpi,
      episodeCount: bundle.episodes.length,
      pageCount: bundle.pages.length,
    },
    files: files.map((file) => ({
      role: file.role,
      path: file.path,
      mimeType: file.mimeType,
      byteSize: file.bytes.byteLength,
      sha256: sha256(file.bytes),
    })),
  };
  return {
    bytes: await createSalesPackageZip(
      manifest,
      files.map((file) => ({ path: file.path, bytes: file.bytes })),
    ),
    mimeType: "application/zip",
    extension: "zip",
  };
}
