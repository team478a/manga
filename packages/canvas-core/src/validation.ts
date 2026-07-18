import { z } from "zod";
import { MAX_PAGE_EDGE, MAX_PAGE_PIXELS } from "./geometry.js";
import type { EpisodeTemplateId } from "./templates.js";
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
const episodeTemplateIds = [
  "short_8",
  "standard_16",
  "four_panel_8",
] as const satisfies readonly EpisodeTemplateId[];
export const episodeTemplateInputSchema = z.object({
  episodeId: z.string().uuid(),
  templateId: z.enum(episodeTemplateIds),
});
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
  shape: z.enum([
    "rectangle",
    "slant_up",
    "slant_down",
    "curve_left",
    "curve_right",
  ]),
  slant: finite.min(0).max(0.45),
  imageAssetId: z.string().uuid().nullable(),
  imageFit: z.enum(["cover", "contain", "manual"]),
  imageOffsetX: finite,
  imageOffsetY: finite,
  imageScale: positive.max(100),
  imageRotation: finite,
  imageOpacity: opacity,
});
export const panelLayerInputSchema = z.object({
  id: z.string().uuid(),
  panelId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  type: z.enum([
    "background",
    "character",
    "prop",
    "effect",
    "tone",
    "mask",
    "correction",
    "flattened_legacy",
  ]),
  orderIndex: z.number().int().min(0).max(10_000),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity,
  blendMode: z.enum(["normal", "multiply", "screen", "overlay"]),
  assetId: z.string().uuid().nullable(),
  sourceJobId: z.string().uuid().nullable(),
  imageFit: z.enum(["cover", "contain", "manual"]),
  imageOffsetX: finite,
  imageOffsetY: finite,
  imageScale: positive.max(100),
  imageRotation: finite,
});
export const panelLayersSaveSchema = z
  .object({
    panelId: z.string().uuid(),
    layers: z.array(panelLayerInputSchema).max(100),
  })
  .superRefine((value, context) => {
    if (value.layers.some((layer) => layer.panelId !== value.panelId))
      context.addIssue({
        code: "custom",
        message: "保存するレイヤーのコマが一致していません。",
      });
    if (
      new Set(value.layers.map((layer) => layer.id)).size !==
      value.layers.length
    )
      context.addIssue({
        code: "custom",
        message: "レイヤーIDが重複しています。",
      });
    if (
      new Set(value.layers.map((layer) => layer.orderIndex)).size !==
      value.layers.length
    )
      context.addIssue({
        code: "custom",
        message: "レイヤーの並び順が重複しています。",
      });
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
export const canvasObjectIdSchema = z.object({
  type: z.enum(["panel", "balloon", "text"]),
  id: z.string().uuid(),
});
export const canvasBatchInputSchema = z
  .object({
    pageId: z.string().uuid(),
    panels: z.array(panelInputSchema).default([]),
    balloons: z.array(balloonInputSchema).default([]),
    textObjects: z.array(textObjectInputSchema).default([]),
    replacePanels: z.boolean().default(false),
    replaceBalloons: z.boolean().default(false),
    replaceTextObjects: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    const items = [...value.panels, ...value.balloons, ...value.textObjects];
    if (items.some((item) => item.pageId !== value.pageId))
      context.addIssue({
        code: "custom",
        message: "一括保存するオブジェクトのページが一致していません。",
      });
  });

const persistedTimestamps = {
  createdAt: z.string().max(100).default(""),
  updatedAt: z.string().max(100).default(""),
};

export const pageCanvasSchema = z
  .object({
    schemaVersion: z.literal(1),
    pageId: z.string().uuid(),
    width: z.number().int().min(100).max(MAX_PAGE_EDGE),
    height: z.number().int().min(100).max(MAX_PAGE_EDGE),
    backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    panels: z.array(panelInputSchema.extend(persistedTimestamps)).max(500),
    panelLayers: z
      .array(panelLayerInputSchema.extend(persistedTimestamps))
      .max(5000),
    balloons: z.array(balloonInputSchema.extend(persistedTimestamps)).max(500),
    textObjects: z
      .array(textObjectInputSchema.extend(persistedTimestamps))
      .max(1000),
  })
  .superRefine((value, context) => {
    const objects = [...value.panels, ...value.balloons, ...value.textObjects];
    if (objects.some((object) => object.pageId !== value.pageId))
      context.addIssue({
        code: "custom",
        message: "CanvasオブジェクトのPageが一致していません。",
      });
    if (new Set(objects.map((object) => object.id)).size !== objects.length)
      context.addIssue({
        code: "custom",
        message: "CanvasオブジェクトIDが重複しています。",
      });
    if (new Set(objects.map((object) => object.zIndex)).size !== objects.length)
      context.addIssue({
        code: "custom",
        message: "Canvasの重なり順が重複しています。",
      });
    if (
      new Set(value.panelLayers.map((layer) => layer.id)).size !==
      value.panelLayers.length
    )
      context.addIssue({
        code: "custom",
        message: "Panel Layer IDが重複しています。",
      });
    for (const panel of value.panels) {
      const layers = value.panelLayers.filter(
        (layer) => layer.panelId === panel.id,
      );
      if (
        new Set(layers.map((layer) => layer.orderIndex)).size !== layers.length
      )
        context.addIssue({
          code: "custom",
          message: "Panel Layerの重なり順が重複しています。",
        });
    }
    const balloonIds = new Set(value.balloons.map((balloon) => balloon.id));
    const panelIds = new Set(value.panels.map((panel) => panel.id));
    if (value.panelLayers.some((layer) => !panelIds.has(layer.panelId)))
      context.addIssue({
        code: "custom",
        message: "Layerが存在しないコマを参照しています。",
      });
    if (
      value.textObjects.some(
        (text) => text.parentBalloonId && !balloonIds.has(text.parentBalloonId),
      )
    )
      context.addIssue({
        code: "custom",
        message: "Textが存在しない吹き出しを参照しています。",
      });
    if (value.width * value.height > MAX_PAGE_PIXELS)
      context.addIssue({
        code: "custom",
        message: "Canvasの総ピクセル数が上限を超えています。",
      });
  });
