import { z } from "zod";
import { ValidationError } from "./domain-errors.ts";
import { featureFlagEnabled } from "./feature-flags.ts";

export const cloudStoryboardFeatureEnabled = () =>
  featureFlagEnabled("CLOUD_STORYBOARD_GENERATION_ENABLED");

const dialogueSchema = z.object({
  type: z.enum(["speech", "thought", "narration"]),
  speaker: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(300),
});
const panelSchema = z.object({
  index: z.number().int().min(1).max(6),
  shot: z.enum(["extreme_close_up", "close_up", "medium", "wide", "establishing", "detail"]),
  cameraAngle: z.enum(["eye_level", "high", "low", "over_shoulder", "top_down", "dynamic"]),
  composition: z.string().trim().min(1).max(700),
  characters: z.array(z.string().trim().min(1).max(100)).max(6),
  background: z.string().trim().min(1).max(500),
  action: z.string().trim().min(1).max(700),
  emotion: z.string().trim().min(1).max(300),
  dialogue: z.array(dialogueSchema).max(4),
  visualDirection: z.string().trim().min(1).max(700),
});
const pageSchema = z.object({
  pageNumber: z.number().int().min(1).max(48),
  sceneIndex: z.number().int().min(1).max(20),
  purpose: z.string().trim().min(1).max(700),
  pageTurnHook: z.string().trim().min(1).max(500),
  panels: z.array(panelSchema).min(1).max(6),
});

export const cloudStoryboardResultSchema = z.object({
  engineVersion: z.literal("openai-storyboard-v1"),
  generatedAt: z.string().datetime(),
  model: z.string().min(1).max(100),
  classification: z.literal("ai_inference"),
  containsGeneratedMarketNumbers: z.literal(false),
  title: z.string().trim().min(1).max(200),
  pageCount: z.number().int().min(8).max(48),
  readingDirection: z.literal("rtl"),
  pages: z.array(pageSchema).min(8).max(48),
  productionNotes: z.object({
    pageRhythm: z.string().trim().min(1).max(1000),
    visualMotifs: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
    continuityRisks: z.array(z.string().trim().min(1).max(500)).min(1).max(5),
  }),
}).superRefine((value, context) => {
  if (value.pages.length !== value.pageCount)
    context.addIssue({ code: "custom", message: "総ページ数とページ構成が一致しません。", path: ["pages"] });
  value.pages.forEach((page, pageIndex) => {
    if (page.pageNumber !== pageIndex + 1)
      context.addIssue({ code: "custom", message: "ページ番号を連番にしてください。", path: ["pages", pageIndex, "pageNumber"] });
    page.panels.forEach((panel, panelIndex) => {
      if (panel.index !== panelIndex + 1)
        context.addIssue({ code: "custom", message: "コマ番号をページ内で連番にしてください。", path: ["pages", pageIndex, "panels", panelIndex, "index"] });
    });
  });
});

export type CloudStoryboardResult = z.infer<typeof cloudStoryboardResultSchema>;

export function assertStoryboardPageCount(pageCount: number) {
  if (!Number.isInteger(pageCount) || pageCount < 8 || pageCount > 48)
    throw new ValidationError("ネーム生成v1は8〜48ページのシナリオに対応しています。");
  return pageCount;
}
