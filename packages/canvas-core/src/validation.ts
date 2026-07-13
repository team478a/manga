import { z } from "zod";
import { MAX_PAGE_EDGE, MAX_PAGE_PIXELS } from "./geometry.js";
const finite = z.number().finite(),
  positive = finite.positive(),
  opacity = finite.min(0).max(1),
  color = z.string().trim().min(1).max(100);
const baseObject = {
  id: z.string().uuid(),
  pageId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  x: finite,
  y: finite,
  width: positive,
  height: positive,
  rotation: finite,
  zIndex: z.number().int().min(0),
  visible: z.boolean(),
  locked: z.boolean(),
};
export const pageSizeSchema = z
  .object({
    width: z.number().int().positive().max(MAX_PAGE_EDGE),
    height: z.number().int().positive().max(MAX_PAGE_EDGE),
  })
  .superRefine((value, context) => {
    if (value.width * value.height > MAX_PAGE_PIXELS)
      context.addIssue({
        code: "custom",
        message: "ページの総ピクセル数が上限を超えています。",
      });
  });
export const panelInputSchema = z.object({
  ...baseObject,
  borderColor: color,
  borderWidth: finite.min(0).max(1000),
  fillColor: color,
  imageAssetId: z.string().uuid().nullable(),
  imageFit: z.enum(["cover", "contain", "manual"]),
  imageOffsetX: finite,
  imageOffsetY: finite,
  imageScale: positive.max(100),
  imageRotation: finite,
  imageOpacity: opacity,
});
export const balloonInputSchema = z.object({
  ...baseObject,
  type: z.enum(["speech_ellipse", "speech_rounded", "narration_box"]),
  fillColor: color,
  strokeColor: color,
  strokeWidth: finite.min(0).max(1000),
  opacity,
  tailDirection: z.enum([
    "none",
    "top",
    "top_right",
    "right",
    "bottom_right",
    "bottom",
    "bottom_left",
    "left",
    "top_left",
  ]),
  tailOffset: finite.min(0).max(1),
});
export const textObjectInputSchema = z.object({
  ...baseObject,
  parentBalloonId: z.string().uuid().nullable(),
  text: z.string().max(50_000),
  writingMode: z.enum(["horizontal", "vertical"]),
  fontFamily: z.string().trim().min(1).max(200),
  fontSize: positive.max(2000),
  fontWeight: z.number().int().min(100).max(900),
  color,
  textAlign: z.enum(["start", "center", "end"]),
  verticalAlign: z.enum(["top", "middle", "bottom"]),
  lineHeight: positive.max(10),
  letterSpacing: finite.min(-100).max(1000),
  padding: finite.min(0).max(5000),
  opacity,
});
