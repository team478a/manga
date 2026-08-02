import type { PageCanvas } from "@mangai/canvas-core";
import {
  createCloudCanvasSvg,
  type CloudCanvasSvgAsset,
} from "../../../../../../lib/cloud-canvas-svg.ts";

export function createCanvasSvg(
  canvas: PageCanvas,
  assets: ReadonlyMap<string, string | CloudCanvasSvgAsset>,
) {
  return createCloudCanvasSvg(
    canvas,
    new Map(
      [...assets].map(([id, asset]) => [
        id,
        typeof asset === "string" ? { href: asset } : asset,
      ]),
    ),
  );
}
