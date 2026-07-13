import JSZip from "jszip";
import { PDFDocument, rgb } from "pdf-lib";

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

export function createProjectManifest(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}
function safeName(value: string) {
  return (
    value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 180) || "page"
  );
}
