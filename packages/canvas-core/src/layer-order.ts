import type { CanvasLayer } from "./types.js";
export function normalizeLayerOrder<T extends { zIndex: number }>(
  values: readonly T[],
): Array<T & { zIndex: number }> {
  return [...values]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((value, zIndex) => ({ ...value, zIndex }));
}
export function moveLayer(
  values: readonly CanvasLayer[],
  id: string,
  targetIndex: number,
) {
  const ordered = normalizeLayerOrder(values),
    currentIndex = ordered.findIndex((value) => value.id === id);
  if (currentIndex < 0) return ordered;
  const [selected] = ordered.splice(currentIndex, 1),
    index = Math.max(0, Math.min(ordered.length, targetIndex));
  ordered.splice(index, 0, selected);
  return ordered.map((value, zIndex) => ({ ...value, zIndex }));
}
