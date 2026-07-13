import type { Balloon } from "./types.js";

export function balloonTailPoints(
  balloon: Pick<Balloon, "tailDirection" | "tailOffset" | "width" | "height">,
) {
  if (balloon.tailDirection === "none") return [];
  const width = balloon.width;
  const height = balloon.height;
  const horizontal = width * balloon.tailOffset;
  const vertical = height * balloon.tailOffset;
  const base = Math.max(12, Math.min(width, height) * 0.08);
  const length = Math.max(30, Math.min(width, height) * 0.3);
  switch (balloon.tailDirection) {
    case "top":
      return [horizontal - base, 0, horizontal, -length, horizontal + base, 0];
    case "top_right":
      return [width - base, 0, width + length, -length, width, base];
    case "right":
      return [
        width,
        vertical - base,
        width + length,
        vertical,
        width,
        vertical + base,
      ];
    case "bottom_right":
      return [
        width,
        height - base,
        width + length,
        height + length,
        width - base,
        height,
      ];
    case "bottom":
      return [
        horizontal - base,
        height,
        horizontal,
        height + length,
        horizontal + base,
        height,
      ];
    case "bottom_left":
      return [base, height, -length, height + length, 0, height - base];
    case "left":
      return [0, vertical - base, -length, vertical, 0, vertical + base];
    case "top_left":
      return [0, base, -length, -length, base, 0];
  }
}
