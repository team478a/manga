import JSZip from "jszip";
import { PDFDocument, rgb } from "pdf-lib";
import {
  CONTENT_POLICY_VERSION,
  contentClassSchema,
  productSurfaceSchema,
  resolveProjectContentClass,
  type ContentClass,
  type ProductSurface,
} from "@mangai/shared";

export type SalesTextInput = {
  title: string;
  subtitle?: string;
  genre?: string;
  tags?: string[];
  ageRating?: string;
};
export type ExportImage = {
  fileName: string;
  bytes: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
};
export const SALES_PACKAGE_FORMAT = "mangai.sales-package" as const;
export const SALES_PACKAGE_VERSION = 2 as const;
export type SalesPackageFileRole =
  | "product_pdf"
  | "page_images_zip"
  | "cover"
  | "sample"
  | "project_info"
  | "description"
  | "social_post";
export type SalesPackageManifest = {
  format: typeof SALES_PACKAGE_FORMAT;
  version: typeof SALES_PACKAGE_VERSION;
  createdAt: string;
  createdBySurface: ProductSurface;
  policyVersion: typeof CONTENT_POLICY_VERSION;
  work: {
    sourceProjectId: string;
    title: string;
    subtitle: string;
    description: string;
    genre: string;
    ageRating: string;
    contentClass: ContentClass;
    readingDirection: "rtl" | "ltr";
    width: number;
    height: number;
    dpi: number;
    episodeCount: number;
    pageCount: number;
  };
  files: Array<{
    role: SalesPackageFileRole;
    path: string;
    mimeType: string;
    byteSize: number;
    sha256: string;
  }>;
};
const salesPackageFileRoles = [
  "product_pdf",
  "page_images_zip",
  "cover",
  "sample",
  "project_info",
  "description",
  "social_post",
] as const satisfies readonly SalesPackageFileRole[];

function safePackagePath(value: string) {
  return (
    value.length > 0 &&
    value.length <= 240 &&
    !value.startsWith("/") &&
    !value.startsWith("\\") &&
    !/^[a-z]:/i.test(value) &&
    !value.split(/[\\/]/).includes("..") &&
    !/[\u0000-\u001f]/.test(value)
  );
}

export function parseSalesPackageManifest(
  value: unknown,
): SalesPackageManifest {
  if (!value || typeof value !== "object")
    throw new Error("販売パッケージ情報が不正です。");
  const source = value as Record<string, unknown>;
  const sourceWork = source.work as Record<string, unknown> | undefined;
  const sourceVersion = source.version;
  const legacy = sourceVersion === 1;
  const manifest = {
    ...source,
    version: SALES_PACKAGE_VERSION,
    createdBySurface: legacy
      ? "desktop"
      : productSurfaceSchema.parse(source.createdBySurface),
    policyVersion: legacy ? CONTENT_POLICY_VERSION : source.policyVersion,
    work: {
      ...sourceWork,
      contentClass: resolveProjectContentClass({
        ageRating: sourceWork?.ageRating,
        contentClass: legacy ? undefined : sourceWork?.contentClass,
      }),
    },
  } as SalesPackageManifest;
  const work = manifest.work;
  if (
    manifest.format !== SALES_PACKAGE_FORMAT ||
    (sourceVersion !== 1 && sourceVersion !== SALES_PACKAGE_VERSION) ||
    typeof manifest.createdAt !== "string" ||
    manifest.policyVersion !== CONTENT_POLICY_VERSION ||
    !work ||
    typeof work.sourceProjectId !== "string" ||
    typeof work.title !== "string" ||
    typeof work.subtitle !== "string" ||
    typeof work.description !== "string" ||
    typeof work.genre !== "string" ||
    typeof work.ageRating !== "string" ||
    !contentClassSchema.safeParse(work.contentClass).success ||
    (work.readingDirection !== "rtl" && work.readingDirection !== "ltr") ||
    !Number.isSafeInteger(work.width) ||
    work.width <= 0 ||
    !Number.isSafeInteger(work.height) ||
    work.height <= 0 ||
    !Number.isSafeInteger(work.dpi) ||
    work.dpi <= 0 ||
    !Number.isSafeInteger(work.episodeCount) ||
    work.episodeCount < 0 ||
    !Number.isSafeInteger(work.pageCount) ||
    work.pageCount < 0 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length > 1000
  )
    throw new Error("対応していない販売パッケージです。");
  const paths = new Set<string>();
  for (const file of manifest.files) {
    if (
      !safePackagePath(file.path) ||
      paths.has(file.path) ||
      !Number.isSafeInteger(file.byteSize) ||
      file.byteSize < 0 ||
      !/^[0-9a-f]{64}$/.test(file.sha256) ||
      typeof file.mimeType !== "string" ||
      !salesPackageFileRoles.includes(file.role)
    )
      throw new Error("販売パッケージのファイル情報が不正です。");
    paths.add(file.path);
  }
  return manifest;
}

export async function createSalesPackageZip(
  manifest: SalesPackageManifest,
  files: Array<{ path: string; bytes: Uint8Array }>,
) {
  const parsed = parseSalesPackageManifest(manifest);
  const inputs = new Map(files.map((file) => [file.path, file.bytes]));
  if (
    inputs.size !== files.length ||
    parsed.files.some((file) => !inputs.has(file.path)) ||
    inputs.size !== parsed.files.length ||
    parsed.files.some(
      (file) => inputs.get(file.path)!.byteLength !== file.byteSize,
    )
  )
    throw new Error("販売パッケージの実ファイルがmanifestと一致しません。");
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(parsed, null, 2));
  for (const file of parsed.files) zip.file(file.path, inputs.get(file.path)!);
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function createSalesTextDraft(input: SalesTextInput) {
  const genre = input.genre || "漫画";
  const tags = input.tags?.length ? input.tags : ["AI漫画", genre, "創作"];
  return {
    catchCopy: input.subtitle
      ? `${input.subtitle} - ${input.title}`
      : `${input.title}、いま届けたい物語。`,
    description: `${input.title}は、作品世界とキャラクターの魅力を楽しめる${genre}作品です。`,
    snsPost: `新作「${input.title}」の販売準備ができました。\n${tags.map((x) => `#${x.replace(/\s/g, "")}`).join(" ")}`,
    tags,
  };
}

export async function createImagesZip(images: ExportImage[]) {
  const zip = new JSZip();
  images.forEach((image, index) =>
    zip.file(
      /^\d+\.[a-z0-9]+$/i.test(image.fileName)
        ? safeName(image.fileName)
        : `${String(index + 1).padStart(3, "0")}-${safeName(image.fileName)}`,
      image.bytes,
    ),
  );
  if (!images.length)
    zip.file("README.txt", "ページ画像は登録されていません。");
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function createPagesPdf(
  images: ExportImage[],
  options: { dpi: number },
) {
  const pdf = await PDFDocument.create();
  for (const source of images) {
    if (source.mimeType !== "image/jpeg" && source.mimeType !== "image/png")
      continue;
    const image =
      source.mimeType === "image/png"
        ? await pdf.embedPng(source.bytes)
        : await pdf.embedJpg(source.bytes);
    const pageWidth = (source.width / options.dpi) * 72,
      pageHeight = (source.height / options.dpi) * 72;
    const page = pdf.addPage([pageWidth, pageHeight]);
    const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
    const width = image.width * scale,
      height = image.height * scale;
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(1, 1, 1),
    });
    page.drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    });
  }
  if (pdf.getPageCount() === 0) pdf.addPage([595.28, 841.89]);
  return pdf.save();
}

export async function mergePagesPdfs(documents: Uint8Array[]) {
  const output = await PDFDocument.create();
  for (const bytes of documents) {
    const source = await PDFDocument.load(bytes);
    const pages = await output.copyPages(source, source.getPageIndices());
    for (const page of pages) output.addPage(page);
  }
  if (output.getPageCount() === 0) output.addPage([595.28, 841.89]);
  return output.save();
}

export function createProjectManifest(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}
function safeName(value: string) {
  return (
    value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 180) || "page"
  );
}
