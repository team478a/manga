import { z } from "zod";
import type { CloudScenarioResult } from "./cloud-scenario.ts";
import { ContentRejectedError, ValidationError } from "./domain-errors.ts";

export const cloudMangaFeatureEnabled = () =>
  process.env.CLOUD_MANGA_MVP_ENABLED?.toLowerCase() === "true";

const layoutSchema = z.enum([
  "single",
  "top_one_bottom_two",
  "four_equal",
  "six_equal",
]);

const pageRoleSchema = z.enum([
  "opening",
  "development",
  "turning_point",
  "climax",
  "resolution",
]);

export const cloudMangaPlanResultSchema = z.object({
  engineVersion: z.literal("manga-layout-rules-v1"),
  generatedAt: z.string().datetime(),
  classification: z.literal("ai_inference"),
  title: z.string().min(1).max(200),
  totalPages: z.number().int().min(1).max(200),
  projectSettings: z.object({
    ageRating: z.literal("全年齢"),
    readingDirection: z.literal("rtl"),
    width: z.literal(1600),
    height: z.literal(2400),
    dpi: z.literal(300),
  }),
  scenarioTrace: z.object({
    confirmationId: z.string().uuid(),
    scenarioRunId: z.string().uuid(),
    proposalSelectionId: z.string().uuid(),
  }),
  pages: z
    .array(
      z.object({
        pageNumber: z.number().int().min(1).max(200),
        sceneId: z.string().regex(/^scene-\d{2}$/),
        sceneHeading: z.string().min(1).max(200),
        sceneSummary: z.string().min(1).max(2000),
        pageRole: pageRoleSchema,
        layoutId: layoutSchema,
        panelCount: z.union([
          z.literal(1),
          z.literal(3),
          z.literal(4),
          z.literal(6),
        ]),
      }),
    )
    .min(1)
    .max(200),
});
export type CloudMangaPlanResult = z.infer<
  typeof cloudMangaPlanResultSchema
>;

const panelCounts: Record<z.infer<typeof layoutSchema>, 1 | 3 | 4 | 6> = {
  single: 1,
  top_one_bottom_two: 3,
  four_equal: 4,
  six_equal: 6,
};

function layoutForPage(
  pageNumber: number,
  totalPages: number,
  sceneStart: number,
  sceneEnd: number,
) {
  if (
    pageNumber === 1 ||
    pageNumber === totalPages ||
    pageNumber === sceneStart
  )
    return "single" as const;
  if (pageNumber === sceneEnd) return "top_one_bottom_two" as const;
  return pageNumber % 3 === 0
    ? ("six_equal" as const)
    : ("four_equal" as const);
}

export function runCloudMangaPlan(
  input: {
    confirmationId: string;
    scenarioRunId: string;
    proposalSelectionId: string;
    scenario: CloudScenarioResult;
    contentClass: "general" | "adult";
  },
  generatedAt = new Date().toISOString(),
): CloudMangaPlanResult {
  if (input.contentClass !== "general")
    throw new ContentRejectedError(
      "成人向けマンガはCloudでは生成できません。MANGAI Desktop Adultを利用してください。",
    );
  if (input.scenario.totalPages > 200)
    throw new ValidationError(
      "マンガ下書き生成MVPは200Page以下のシナリオに対応しています。",
    );

  const pages = Array.from(
    { length: input.scenario.totalPages },
    (_, index) => {
      const pageNumber = index + 1;
      const scene = input.scenario.scenes.find(
        (candidate) =>
          pageNumber >= candidate.pageStart &&
          pageNumber <= candidate.pageEnd,
      );
      if (!scene)
        throw new ValidationError(
          `${pageNumber}Pageに対応するSceneがありません。`,
        );
      const layoutId = layoutForPage(
        pageNumber,
        input.scenario.totalPages,
        scene.pageStart,
        scene.pageEnd,
      );
      const pageRole =
        pageNumber === 1
          ? ("opening" as const)
          : pageNumber === input.scenario.totalPages
            ? ("resolution" as const)
            : pageNumber === scene.pageEnd
              ? ("turning_point" as const)
              : pageNumber > input.scenario.totalPages * 0.75
                ? ("climax" as const)
                : ("development" as const);
      return {
        pageNumber,
        sceneId: scene.id,
        sceneHeading: scene.heading,
        sceneSummary: scene.summary,
        pageRole,
        layoutId,
        panelCount: panelCounts[layoutId],
      };
    },
  );

  return cloudMangaPlanResultSchema.parse({
    engineVersion: "manga-layout-rules-v1",
    generatedAt,
    classification: "ai_inference",
    title: input.scenario.title,
    totalPages: input.scenario.totalPages,
    projectSettings: {
      ageRating: "全年齢",
      readingDirection: "rtl",
      width: 1600,
      height: 2400,
      dpi: 300,
    },
    scenarioTrace: {
      confirmationId: input.confirmationId,
      scenarioRunId: input.scenarioRunId,
      proposalSelectionId: input.proposalSelectionId,
    },
    pages,
  });
}
