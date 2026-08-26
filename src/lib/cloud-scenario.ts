import { z } from "zod";
import { featureFlagEnabled } from "./feature-flags.ts";

export const cloudScenarioFeatureEnabled = () =>
  featureFlagEnabled("CLOUD_SCENARIO_GENERATION_ENABLED");

const characterSchema = z.object({
  id: z.string().regex(/^character-[1-6]$/),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["protagonist", "supporting", "antagonist"]),
  desire: z.string().trim().min(1).max(500),
  fear: z.string().trim().min(1).max(500),
  conflict: z.string().trim().min(1).max(500),
  arc: z.string().trim().min(1).max(800),
});
const actSchema = z.object({
  act: z.enum(["setup", "confrontation", "resolution"]),
  pageStart: z.number().int().min(1).max(2000),
  pageEnd: z.number().int().min(1).max(2000),
  purpose: z.string().trim().min(1).max(1000),
  turningPoint: z.string().trim().min(1).max(1000),
});
const sceneSchema = z.object({
  index: z.number().int().min(1).max(20),
  pageStart: z.number().int().min(1).max(2000),
  pageEnd: z.number().int().min(1).max(2000),
  title: z.string().trim().min(1).max(200),
  purpose: z.string().trim().min(1).max(800),
  summary: z.string().trim().min(1).max(1500),
  emotionalBeat: z.string().trim().min(1).max(500),
  hook: z.string().trim().min(1).max(500),
  dialogueGoal: z.string().trim().min(1).max(500),
});

export const cloudStoryScenarioResultSchema = z
  .object({
    engineVersion: z.literal("openai-scenario-v1"),
    generatedAt: z.string().datetime(),
    model: z.string().min(1).max(100),
    classification: z.literal("ai_inference"),
    containsGeneratedMarketNumbers: z.literal(false),
    title: z.string().trim().min(1).max(200),
    oneSentencePitch: z.string().trim().min(1).max(1000),
    pageCount: z.number().int().min(4).max(200),
    characters: z.array(characterSchema).min(2).max(6),
    acts: z.array(actSchema).length(3),
    scenes: z.array(sceneSchema).min(3).max(20),
    commercialAlignment: z.object({
      openingHook: z.string().trim().min(1).max(1000),
      readerPayoff: z.string().trim().min(1).max(1000),
      differentiation: z.string().trim().min(1).max(1000),
      productionRisks: z.array(z.string().trim().min(1).max(500)).min(1).max(4),
    }),
  })
  .superRefine((value, context) => {
    const characterIds = new Set(value.characters.map((item) => item.id));
    const names = new Set(value.characters.map((item) => item.name.toLocaleLowerCase()));
    if (characterIds.size !== value.characters.length || names.size !== value.characters.length)
      context.addIssue({ code: "custom", message: "登場人物が重複しています。", path: ["characters"] });
    if (value.characters.filter((item) => item.role === "protagonist").length !== 1)
      context.addIssue({ code: "custom", message: "主人公は1名にしてください。", path: ["characters"] });
    const expectedActs = ["setup", "confrontation", "resolution"];
    value.acts.forEach((act, index) => {
      if (act.act !== expectedActs[index] || act.pageStart > act.pageEnd)
        context.addIssue({ code: "custom", message: "三幕構成のページ範囲を確認してください。", path: ["acts", index] });
      if (index === 0 && act.pageStart !== 1)
        context.addIssue({ code: "custom", message: "構成は1ページ目から開始してください。", path: ["acts", index] });
      if (index > 0 && act.pageStart !== value.acts[index - 1]!.pageEnd + 1)
        context.addIssue({ code: "custom", message: "構成のページ範囲を連続させてください。", path: ["acts", index] });
    });
    if (value.acts[2]?.pageEnd !== value.pageCount)
      context.addIssue({ code: "custom", message: "構成は最終ページまで含めてください。", path: ["acts", 2] });
    value.scenes.forEach((scene, index) => {
      if (scene.index !== index + 1 || scene.pageStart > scene.pageEnd || scene.pageEnd > value.pageCount)
        context.addIssue({ code: "custom", message: "シーンの順序とページ範囲を確認してください。", path: ["scenes", index] });
    });
  });

export type CloudStoryScenarioResult = z.infer<typeof cloudStoryScenarioResultSchema>;

export function scenarioPageCount(input: {
  pageCount: number;
  publicationFormat: "auto" | "series" | "one_shot";
}) {
  if (input.pageCount >= 4 && input.pageCount <= 200) return input.pageCount;
  return input.publicationFormat === "series" ? 24 : 32;
}
