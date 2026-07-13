import type { ImageFit, PageSize, Point, Rect } from "./types.js";
export const MIN_CANVAS_OBJECT_SIZE = 16;
export const MAX_PAGE_EDGE = 20_000;
export const MAX_PAGE_PIXELS = 100_000_000;
export type ViewportTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};
export function pageToViewport(
  point: Point,
  viewport: ViewportTransform,
): Point {
  return {
    x: point.x * viewport.scale + viewport.offsetX,
    y: point.y * viewport.scale + viewport.offsetY,
  };
}
export function viewportToPage(
  point: Point,
  viewport: ViewportTransform,
): Point {
  if (!Number.isFinite(viewport.scale) || viewport.scale <= 0)
    throw new Error("表示倍率は正数である必要があります。");
  return {
    x: (point.x - viewport.offsetX) / viewport.scale,
    y: (point.y - viewport.offsetY) / viewport.scale,
  };
}
export function pageRectToViewport(
  rect: Rect,
  viewport: ViewportTransform,
): Rect {
  const point = pageToViewport(rect, viewport);
  return {
    ...point,
    width: rect.width * viewport.scale,
    height: rect.height * viewport.scale,
  };
}
export function constrainRectToPage(
  rect: Rect,
  page: PageSize,
  minimumSize = MIN_CANVAS_OBJECT_SIZE,
): Rect {
  const minWidth = Math.min(minimumSize, page.width),
    minHeight = Math.min(minimumSize, page.height),
    width = clamp(Math.abs(rect.width), minWidth, page.width),
    height = clamp(Math.abs(rect.height), minHeight, page.height);
  return {
    x: clamp(rect.x, 0, page.width - width),
    y: clamp(rect.y, 0, page.height - height),
    width,
    height,
  };
}
export function normalizeRotation(value: number) {
  if (!Number.isFinite(value)) return 0;
  const rotation = value % 360;
  return rotation < 0 ? rotation + 360 : rotation;
}
export function estimateRgbaMemoryBytes(page: PageSize) {
  return page.width * page.height * 4;
}
export function computeImagePlacement(
  source: PageSize,
  frame: Rect,
  options: {
    fit: ImageFit;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
  },
): Rect {
  if (source.width <= 0 || source.height <= 0)
    throw new Error("画像サイズは正数である必要があります。");
  const containScale = Math.min(
    frame.width / source.width,
    frame.height / source.height,
  );
  const coverScale = Math.max(
    frame.width / source.width,
    frame.height / source.height,
  );
  const fitScale = options.fit === "cover" ? coverScale : containScale;
  const editScale = Math.max(0.01, options.scale ?? 1);
  const scale = fitScale * editScale;
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    x: frame.x + (frame.width - width) / 2 + (options.offsetX ?? 0),
    y: frame.y + (frame.height - height) / 2 + (options.offsetY ?? 0),
    width,
    height,
  };
}
function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
