import { z } from "zod";
import { panelSpecificationSchema } from "./panel-specification.ts";
import { VISUAL_JUDGE_FAILURE_CATEGORIES } from "./visual-judge-failure.ts";

export const qualityBenchmarkSeveritySchema = z.enum([
  "minor",
  "major",
  "critical",
]);

const privateFixtureAssetSchema = z
  .object({
    path: z
      .string()
      .trim()
      .regex(/^assets\/[a-zA-Z0-9][a-zA-Z0-9._/-]*\.(?:png|jpe?g|webp)$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    width: z.number().int().positive().max(16_384),
    height: z.number().int().positive().max(16_384),
  })
  .superRefine((value, context) => {
    if (value.path.split("/").includes("..") || value.path.includes("//"))
      context.addIssue({
        code: "custom",
        path: ["path"],
        message: "fixture asset path must stay inside assets",
      });
  });

export const qualityBenchmarkFixtureSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/),
    asset: privateFixtureAssetSchema,
    panelSpecification: panelSpecificationSchema,
    labels: z.object({
      adoptable: z.boolean(),
      failureCategories: z
        .array(z.enum(VISUAL_JUDGE_FAILURE_CATEGORIES))
        .max(VISUAL_JUDGE_FAILURE_CATEGORIES.length),
      severity: qualityBenchmarkSeveritySchema,
    }),
    ownerReviewNotes: z.string().trim().min(1).max(1_000).optional(),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.labels.failureCategories).size !==
      value.labels.failureCategories.length
    )
      context.addIssue({
        code: "custom",
        path: ["labels", "failureCategories"],
        message: "fixture failure categories must be unique",
      });
    if (!value.labels.adoptable && !value.labels.failureCategories.length)
      context.addIssue({
        code: "custom",
        path: ["labels", "failureCategories"],
        message: "non-adoptable fixtures require a failure category",
      });
    if (value.labels.adoptable && value.labels.severity === "critical")
      context.addIssue({
        code: "custom",
        path: ["labels", "severity"],
        message: "adoptable fixtures cannot be critical",
      });
  });

export const qualityBenchmarkManifestSchema = z
  .object({
    version: z.literal(1),
    datasetId: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/),
    fixtureUse: z.literal("private-local"),
    fixtures: z.array(qualityBenchmarkFixtureSchema).max(50),
  })
  .superRefine((value, context) => {
    const ids = value.fixtures.map((fixture) => fixture.id);
    const paths = value.fixtures.map((fixture) => fixture.asset.path);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        path: ["fixtures"],
        message: "fixture IDs must be unique",
      });
    if (new Set(paths).size !== paths.length)
      context.addIssue({
        code: "custom",
        path: ["fixtures"],
        message: "fixture asset paths must be unique",
      });
  });

export const QUALITY_BENCHMARK_CATEGORY_TARGETS = {
  character_identity: ["character_mismatch", "face_mismatch"],
  anatomy_or_fusion: ["body_distortion", "hand_error", "body_prop_fusion"],
  text_or_ui: ["text_artifact", "ui_artifact"],
  composition_or_crop: ["wrong_camera", "crop_mismatch"],
  orientation_or_gravity: ["orientation_error", "gravity_error"],
  background_or_prop: ["wrong_background", "missing_prop", "prop_fusion"],
} as const;

export type QualityBenchmarkFixture = z.infer<
  typeof qualityBenchmarkFixtureSchema
>;
export type QualityBenchmarkManifest = z.infer<
  typeof qualityBenchmarkManifestSchema
>;

export function inspectQualityBenchmarkReadiness(
  manifest: QualityBenchmarkManifest,
) {
  const adoptableCount = manifest.fixtures.filter(
    (fixture) => fixture.labels.adoptable,
  ).length;
  const categoryCounts = Object.fromEntries(
    Object.entries(QUALITY_BENCHMARK_CATEGORY_TARGETS).map(
      ([category, failureCategories]) => [
        category,
        manifest.fixtures.filter((fixture) =>
          fixture.labels.failureCategories.some((failure) =>
            (failureCategories as readonly string[]).includes(failure),
          ),
        ).length,
      ],
    ),
  );
  const missingCategoryCases = Object.entries(categoryCounts).reduce<
    Record<string, number>
  >((missing, [category, count]) => {
    const missingCount = Math.max(0, 5 - count);
    if (missingCount > 0) missing[category] = missingCount;
    return missing;
  }, {});
  const missingTotalCases = Math.max(0, 30 - manifest.fixtures.length);
  const missingAdoptableCases = Math.max(0, 15 - adoptableCount);
  return {
    ready:
      missingTotalCases === 0 &&
      missingAdoptableCases === 0 &&
      Object.keys(missingCategoryCases).length === 0,
    fixtureCount: manifest.fixtures.length,
    adoptableCount,
    categoryCounts,
    missingTotalCases,
    missingAdoptableCases,
    missingCategoryCases,
  };
}
