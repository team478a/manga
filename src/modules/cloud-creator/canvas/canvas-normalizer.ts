import { pageCanvasSchema } from "@mangai/canvas-core";
import type { CloudPage } from "../contracts/types";

export function normalizeCloudCanvas(
  page: Pick<CloudPage, "id" | "width" | "height" | "background_color">,
  value: unknown,
) {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const canvas = pageCanvasSchema.safeParse({
    schemaVersion: 1,
    pageId: page.id,
    width: page.width,
    height: page.height,
    backgroundColor: source.backgroundColor ?? page.background_color,
    panels: source.panels ?? [],
    panelLayers: source.panelLayers ?? [],
    balloons: source.balloons ?? [],
    textObjects: source.textObjects ?? [],
  });
  if (!canvas.success) {
    throw new Error(
      "Canvasデータが不正なため、安全に読み込めませんでした。",
    );
  }
  return canvas.data;
}
