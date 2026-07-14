import type { PanelShape } from "./types.js";

export type PanelShapeCommand =
  | { type: "move" | "line"; x: number; y: number }
  | {
      type: "curve";
      control1X: number;
      control1Y: number;
      control2X: number;
      control2Y: number;
      x: number;
      y: number;
    }
  | { type: "close" };

type PanelShapeInput = {
  width: number;
  height: number;
  shape: PanelShape;
  slant: number;
};

function dimensions(input: PanelShapeInput) {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  return {
    width,
    height,
    offset: Math.min(width * 0.45, Math.max(0, width * input.slant)),
  };
}

export function panelShapeCommands(
  input: PanelShapeInput,
): PanelShapeCommand[] {
  const { width, height, offset } = dimensions(input);
  if (input.shape === "curve_left")
    return [
      { type: "move", x: 0, y: 0 },
      { type: "line", x: width, y: 0 },
      { type: "line", x: width, y: height },
      { type: "line", x: 0, y: height },
      {
        type: "curve",
        control1X: offset,
        control1Y: height * 0.72,
        control2X: offset,
        control2Y: height * 0.28,
        x: 0,
        y: 0,
      },
      { type: "close" },
    ];
  if (input.shape === "curve_right")
    return [
      { type: "move", x: 0, y: 0 },
      { type: "line", x: width, y: 0 },
      {
        type: "curve",
        control1X: width - offset,
        control1Y: height * 0.28,
        control2X: width - offset,
        control2Y: height * 0.72,
        x: width,
        y: height,
      },
      { type: "line", x: 0, y: height },
      { type: "close" },
    ];
  const points = panelShapePoints(input);
  return [
    { type: "move", x: points[0], y: points[1] },
    ...Array.from({ length: points.length / 2 - 1 }, (_, index) => ({
      type: "line" as const,
      x: points[(index + 1) * 2],
      y: points[(index + 1) * 2 + 1],
    })),
    { type: "close" },
  ];
}

function coordinate(value: number) {
  return Number(value.toFixed(3)).toString();
}

export function panelShapeSvgPath(input: PanelShapeInput) {
  return panelShapeCommands(input)
    .map((command) => {
      if (command.type === "close") return "Z";
      if (command.type === "curve")
        return `C ${coordinate(command.control1X)} ${coordinate(command.control1Y)} ${coordinate(command.control2X)} ${coordinate(command.control2Y)} ${coordinate(command.x)} ${coordinate(command.y)}`;
      return `${command.type === "move" ? "M" : "L"} ${coordinate(command.x)} ${coordinate(command.y)}`;
    })
    .join(" ");
}

export function panelShapePoints(input: PanelShapeInput) {
  const { width, height, offset } = dimensions(input);
  if (input.shape === "slant_up")
    return [offset, 0, width, 0, width - offset, height, 0, height];
  if (input.shape === "slant_down")
    return [0, 0, width - offset, 0, width, height, offset, height];
  return [0, 0, width, 0, width, height, 0, height];
}
