import type { PageCanvas } from "@mangai/canvas-core";
import { createCanvasSvg } from "./canvas-svg";

async function asDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Assetを読み込めませんでした。");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Assetを変換できませんでした。"));
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadCanvasPng({
  canvas,
  assets,
  fileName,
}: {
  canvas: PageCanvas;
  assets: ReadonlyArray<{ id: string; url: string }>;
  fileName: string;
}) {
  const dataUrls = new Map<string, string>();
  await Promise.all(
    assets.map(async (asset) =>
      dataUrls.set(asset.id, await asDataUrl(asset.url)),
    ),
  );
  const svg = createCanvasSvg(canvas, dataUrls);
  const image = new Image();
  const svgUrl = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml" }),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("Previewを描画できませんでした。"));
      image.src = svgUrl;
    });
    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    output.getContext("2d")?.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("PNGを作成できませんでした。");
    downloadBlob(blob, fileName);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
