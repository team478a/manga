import type { ImageFit, PageSize, Point, Rect } from "./types.js";
export const MIN_CANVAS_OBJECT_SIZE = 16;
export const MAX_PAGE_EDGE = 20_000;
export const MAX_PAGE_PIXELS = 100_000_000;
export type ViewportTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};
export function snapPointToGrid(point: Point, gridSize: number): Point {
  if (!Number.isFinite(gridSize) || gridSize <= 0)
    throw new Error("グリッド間隔は正数である必要があります。");
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}
export function snapRectToGrid(rect: Rect, gridSize: number): Rect {
  return { ...rect, ...snapPointToGrid(rect, gridSize) };
}
export function rectFromPoints(
  start: Point,
  end: Point,
  page: PageSize,
  gridSize?: number,
): Rect {
  const first = gridSize ? snapPointToGrid(start, gridSize) : start;
  const second = gridSize ? snapPointToGrid(end, gridSize) : end;
  const startX = clamp(first.x, 0, page.width);
  const startY = clamp(first.y, 0, page.height);
  const endX = clamp(second.x, 0, page.width);
  const endY = clamp(second.y, 0, page.height);
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}
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
export function remapChildRect(
  child: Rect,
  previousParent: Rect,
  nextParent: Rect,
): Rect {
  const scaleX = nextParent.width / previousParent.width;
  const scaleY = nextParent.height / previousParent.height;
  return {
    x: nextParent.x + (child.x - previousParent.x) * scaleX,
    y: nextParent.y + (child.y - previousParent.y) * scaleY,
    width: child.width * scaleX,
    height: child.height * scaleY,
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
export type SnapResult = {
  rect: Rect;
  guides: { vertical: number[]; horizontal: number[] };
};
export function snapRectToGuides(
  rect: Rect,
  page: PageSize,
  others: readonly Rect[] = [],
  threshold = 8,
): SnapResult {
  const verticalTargets = [0, page.width / 2, page.width];
  const horizontalTargets = [0, page.height / 2, page.height];
  for (const other of others) {
    verticalTargets.push(
      other.x,
      other.x + other.width / 2,
      other.x + other.width,
    );
    horizontalTargets.push(
      other.y,
      other.y + other.height / 2,
      other.y + other.height,
    );
  }
  const xSnap = nearestSnap(
    [rect.x, rect.x + rect.width / 2, rect.x + rect.width],
    verticalTargets,
    threshold,
  );
  const ySnap = nearestSnap(
    [rect.y, rect.y + rect.height / 2, rect.y + rect.height],
    horizontalTargets,
    threshold,
  );
  return {
    rect: {
      ...rect,
      x: rect.x + (xSnap?.delta ?? 0),
      y: rect.y + (ySnap?.delta ?? 0),
    },
    guides: {
      vertical: xSnap ? [xSnap.target] : [],
      horizontal: ySnap ? [ySnap.target] : [],
    },
  };
}
function nearestSnap(anchors: number[], targets: number[], threshold: number) {
  let best: { target: number; delta: number; distance: number } | undefined;
  for (const anchor of anchors)
    for (const target of targets) {
      const delta = target - anchor;
      const distance = Math.abs(delta);
      if (distance <= threshold && (!best || distance < best.distance))
        best = { target, delta, distance };
    }
  return best;
}
function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
