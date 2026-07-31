import sharp from "sharp";
import type { PageCanvas } from "@mangai/canvas-core";
import {
  createCloudCanvasSvg,
  type CloudCanvasSvgAsset,
} from "./cloud-canvas-svg.ts";

function dataUri(mimeType: string, bytes: Uint8Array) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function renderCloudCanvasPng(
  canvas: PageCanvas,
  assets: Map<string, { mimeType: string; bytes: Uint8Array }>,
) {
  const svgAssets = new Map<string, CloudCanvasSvgAsset>();
  await Promise.all(
    [...assets.entries()].map(async ([id, asset]) => {
      const metadata = await sharp(Buffer.from(asset.bytes)).metadata();
      svgAssets.set(id, {
        href: dataUri(asset.mimeType, asset.bytes),
        width: metadata.width,
        height: metadata.height,
      });
    }),
  );
  const svg = createCloudCanvasSvg(canvas, svgAssets);
  return new Uint8Array(
    await sharp(Buffer.from(svg), { limitInputPixels: 100_000_000 })
      .png()
      .toBuffer(),
  );
}
