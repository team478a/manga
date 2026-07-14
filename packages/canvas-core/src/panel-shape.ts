import type { PanelShape } from "./types.js";

export function panelShapePoints(input: {
  width: number;
  height: number;
  shape: PanelShape;
  slant: number;
}) {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  const offset = Math.min(width * 0.45, Math.max(0, width * input.slant));
  if (input.shape === "slant_up")
    return [offset, 0, width, 0, width - offset, height, 0, height];
  if (input.shape === "slant_down")
    return [0, 0, width - offset, 0, width, height, offset, height];
  return [0, 0, width, 0, width, height, 0, height];
}
