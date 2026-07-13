import type { CanvasLayer } from "./types.js";
export type LayerKey = Pick<CanvasLayer, "id" | "type">;
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
export function reorderLayer(
  values: readonly CanvasLayer[],
  dragged: LayerKey,
  target: LayerKey,
  placement: "before" | "after",
) {
  const sameKey = (value: LayerKey, key: LayerKey) =>
    value.id === key.id && value.type === key.type;
  if (sameKey(dragged, target)) return normalizeLayerOrder(values);
  const visualOrder = normalizeLayerOrder(values).reverse();
  const sourceIndex = visualOrder.findIndex((value) => sameKey(value, dragged));
  if (sourceIndex < 0) return normalizeLayerOrder(values);
  const [source] = visualOrder.splice(sourceIndex, 1);
  const targetIndex = visualOrder.findIndex((value) => sameKey(value, target));
  if (targetIndex < 0) return normalizeLayerOrder(values);
  visualOrder.splice(targetIndex + (placement === "after" ? 1 : 0), 0, source);
  return visualOrder.reverse().map((value, zIndex) => ({ ...value, zIndex }));
}
