import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as yazl from "yazl";
import {
  createPagesPdf,
  createProjectManifest,
  createSalesTextDraft,
  type ExportImage,
  type SalesPackageFileRole,
  type SalesPackageManifest,
} from "@mangai/export-core";
import { CONTENT_POLICY_VERSION } from "@mangai/shared";
import { stageCloudProjectExportBundle } from "@/lib/cloud-creator-server";
import { renderCloudCanvasPng } from "@/lib/cloud-canvas-render";

type StagedPage = {
  fileName: string;
  filePath: string;
  width: number;
  height: number;
};

function sha256(bytes: Uint8Array) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function sha256File(filePath: string) {
  const hash = crypto.createHash("sha256");
  let byteSize = 0;
  for await (const chunk of fs.createReadStream(filePath)) {
    const bytes = chunk as Buffer;
    byteSize += bytes.length;
    hash.update(bytes);
  }
  return { byteSize, sha256: hash.digest("hex") };
}

async function writeZip(
  destination: string,
  files: Array<{ path: string; filePath?: string; bytes?: Uint8Array }>,
) {
  const zip = new yazl.ZipFile();
  for (const file of files) {
    if (file.filePath)
      zip.addFile(file.filePath, file.path, { compressionLevel: 6 });
    else zip.addBuffer(Buffer.from(file.bytes ?? []), file.path);
  }
  const output = fs.createWriteStream(destination, {
    flags: "wx",
    mode: 0o600,
  });
  const completed = new Promise<void>((resolve, reject) => {
    zip.outputStream.once("error", reject);
    output.once("error", reject);
    output.once("close", resolve);
  });
  zip.outputStream.pipe(output);
  zip.end();
  await completed;
}

function pageAssetIds(canvas: {
  panels: Array<{
    id: string;
    visible: boolean;
    imageAssetId: string | null;
  }>;
  panelLayers: Array<{
    panelId: string;
    assetId: string | null;
    visible: boolean;
    orderIndex: number;
  }>;
}) {
  const ids = new Set<string>();
  for (const panel of canvas.panels.filter((item) => item.visible)) {
    const assetId =
      canvas.panelLayers
        .filter(
          (layer) =>
            layer.panelId === panel.id && layer.visible && layer.assetId,
        )
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .at(-1)?.assetId ?? panel.imageAssetId;
    if (assetId) ids.add(assetId);
  }
  return ids;
}

async function stageExport(projectId: string) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-cloud-"));
  const assetDirectory = path.join(directory, "assets");
  const pageDirectory = path.join(directory, "pages");
  fs.mkdirSync(pageDirectory);
  try {
    const bundle = await stageCloudProjectExportBundle(
      projectId,
      assetDirectory,
      { concurrency: 3 },
    );
    const assetMetadata = new Map(
      bundle.assets.map((asset) => [asset.id, asset]),
    );
    const pages: StagedPage[] = [];
    for (const page of [...bundle.pages].sort(
      (a, b) => a.page_number - b.page_number,
    )) {
      const assets = new Map<
        string,
        { mimeType: string; bytes: Uint8Array }
      >();
      for (const id of pageAssetIds(page.canvas)) {
        const asset = assetMetadata.get(id);
        if (!asset) continue;
        assets.set(id, {
          mimeType: asset.mime_type,
          bytes: new Uint8Array(await fs.promises.readFile(asset.filePath)),
        });
      }
      const fileName = `${String(page.page_number).padStart(3, "0")}.png`;
      const filePath = path.join(pageDirectory, fileName);
      await fs.promises.writeFile(
        filePath,
        await renderCloudCanvasPng(page.canvas, assets),
        { flag: "wx", mode: 0o600 },
      );
      pages.push({
        fileName,
        filePath,
        width: page.width,
        height: page.height,
      });
    }
    return { directory, bundle, pages };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

async function loadPageImages(pages: StagedPage[]): Promise<ExportImage[]> {
  const images: ExportImage[] = [];
  for (const page of pages)
    images.push({
      fileName: page.fileName,
      bytes: new Uint8Array(await fs.promises.readFile(page.filePath)),
      mimeType: "image/png",
      width: page.width,
      height: page.height,
    });
  return images;
}

export async function createCloudMarketplaceArtifacts(projectId: string) {
  const staged = await stageExport(projectId);
  try {
    if (!staged.pages.length)
      throw new Error("販売用に書き出せるPageがありません。");
    const images = await loadPageImages(staged.pages);
    const coverIndex = Math.max(
      0,
      staged.bundle.pages.findIndex(
        (page) => page.id === staged.bundle.project.cover_page_id,
      ),
    );
    const cover = images[coverIndex]?.bytes;
    if (!cover) throw new Error("販売用の表紙を生成できませんでした。");
    const salesText = createSalesTextDraft({
      title: staged.bundle.project.title,
      ageRating: staged.bundle.project.age_rating,
    });
    return {
      project: staged.bundle.project,
      pdf: await createPagesPdf(images, { dpi: staged.bundle.project.dpi }),
      cover,
      description: salesText.description,
    };
  } finally {
    fs.rmSync(staged.directory, { recursive: true, force: true });
  }
}

export async function createCloudProjectExport(
  projectId: string,
  format: "pdf" | "images" | "package",
) {
  const staged = await stageExport(projectId);
  try {
    const outputPath = path.join(staged.directory, `output.${format === "pdf" ? "pdf" : "zip"}`);
    if (format === "images") {
      await writeZip(
        outputPath,
        staged.pages.map((page) => ({
          path: page.fileName,
          filePath: page.filePath,
        })),
      );
      return {
        filePath: outputPath,
        cleanupPath: staged.directory,
        mimeType: "application/zip",
        extension: "zip",
      };
    }

    const images = await loadPageImages(staged.pages);
    const pdf = await createPagesPdf(images, {
      dpi: staged.bundle.project.dpi,
    });
    if (format === "pdf") {
      await fs.promises.writeFile(outputPath, pdf, {
        flag: "wx",
        mode: 0o600,
      });
      return {
        filePath: outputPath,
        cleanupPath: staged.directory,
        mimeType: "application/pdf",
        extension: "pdf",
      };
    }

    const imageZipPath = path.join(staged.directory, "pages.zip");
    await writeZip(
      imageZipPath,
      staged.pages.map((page) => ({
        path: page.fileName,
        filePath: page.filePath,
      })),
    );
    const pdfPath = path.join(staged.directory, "main.pdf");
    await fs.promises.writeFile(pdfPath, pdf, { flag: "wx", mode: 0o600 });
    const salesText = createSalesTextDraft({
      title: staged.bundle.project.title,
      ageRating: staged.bundle.project.age_rating,
    });
    const projectInfo = createProjectManifest({
      project: staged.bundle.project,
      episodes: staged.bundle.episodes,
      pages: staged.bundle.pages.map(({ canvas: _canvas, ...page }) => page),
    });
    const description = new TextEncoder().encode(salesText.description);
    const socialPost = new TextEncoder().encode(salesText.snsPost);
    const coverIndex = Math.max(
      0,
      staged.bundle.pages.findIndex(
        (page) => page.id === staged.bundle.project.cover_page_id,
      ),
    );
    const coverPath = staged.pages[coverIndex]?.filePath;
    const files: Array<{
      role: SalesPackageFileRole;
      path: string;
      mimeType: string;
      filePath?: string;
      bytes?: Uint8Array;
    }> = [
      {
        role: "product_pdf",
        path: "product/main.pdf",
        mimeType: "application/pdf",
        filePath: pdfPath,
      },
      {
        role: "page_images_zip",
        path: "product/pages.zip",
        mimeType: "application/zip",
        filePath: imageZipPath,
      },
      ...(coverPath
        ? [
            {
              role: "cover" as const,
              path: "product/cover.png",
              mimeType: "image/png",
              filePath: coverPath,
            },
          ]
        : []),
      {
        role: "project_info",
        path: "project.json",
        mimeType: "application/json",
        bytes: projectInfo,
      },
      {
        role: "description",
        path: "sales/description.txt",
        mimeType: "text/plain",
        bytes: description,
      },
      {
        role: "social_post",
        path: "sales/social.txt",
        mimeType: "text/plain",
        bytes: socialPost,
      },
    ];
    const manifestFiles = [];
    for (const file of files) {
      const integrity = file.filePath
        ? await sha256File(file.filePath)
        : {
            byteSize: file.bytes!.byteLength,
            sha256: sha256(file.bytes!),
          };
      manifestFiles.push({
        role: file.role,
        path: file.path,
        mimeType: file.mimeType,
        ...integrity,
      });
    }
    const manifest: SalesPackageManifest = {
      format: "mangai.sales-package",
      version: 2,
      createdAt: new Date().toISOString(),
      createdBySurface: "cloud",
      policyVersion: CONTENT_POLICY_VERSION,
      work: {
        sourceProjectId: staged.bundle.project.id,
        title: staged.bundle.project.title,
        subtitle: "",
        description: staged.bundle.project.description,
        genre: "漫画",
        ageRating: staged.bundle.project.age_rating,
        contentClass: "general",
        readingDirection: staged.bundle.project.reading_direction,
        width: staged.bundle.project.width,
        height: staged.bundle.project.height,
        dpi: staged.bundle.project.dpi,
        episodeCount: staged.bundle.episodes.length,
        pageCount: staged.bundle.pages.length,
      },
      files: manifestFiles,
    };
    await writeZip(outputPath, [
      {
        path: "manifest.json",
        bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
      },
      ...files.map((file) => ({
        path: file.path,
        filePath: file.filePath,
        bytes: file.bytes,
      })),
    ]);
    return {
      filePath: outputPath,
      cleanupPath: staged.directory,
      mimeType: "application/zip",
      extension: "zip",
    };
  } catch (error) {
    fs.rmSync(staged.directory, { recursive: true, force: true });
    throw error;
  }
}
