import { z } from "zod";
import { panelSpecificationSchema } from "./panel-specification.ts";
import type { VisualJudgeFailureCategory } from "./visual-judge-failure.ts";

export const QUALITY_BENCHMARK_VERSION = "2.1" as const;
export const QUALITY_BENCHMARK_SPLIT_TARGETS = {
  dev: { good: 48, bad: 48, borderline: 16 },
  holdout_private: { good: 12, bad: 12, borderline: 4 },
} as const;

export const QUALITY_BENCHMARK_DEFECT_CATEGORIES = [
  "character_identity_mismatch",
  "anatomy_object_fusion",
  "unwanted_text_ui_logo",
  "composition_mismatch",
  "composition_crop_error",
  "orientation_gravity_error",
  "background_prop_mismatch",
] as const;

export type QualityBenchmarkDefectCategory =
  (typeof QUALITY_BENCHMARK_DEFECT_CATEGORIES)[number];

export const QUALITY_BENCHMARK_DEFECT_GROUPS = {
  character_identity: ["character_identity_mismatch"],
  anatomy_or_fusion: ["anatomy_object_fusion"],
  unwanted_text_ui_logo: ["unwanted_text_ui_logo"],
  composition_or_crop: ["composition_mismatch", "composition_crop_error"],
  orientation_or_gravity: ["orientation_gravity_error"],
  background_or_prop: ["background_prop_mismatch"],
} as const;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const caseIdSchema = z.string().regex(/^img_[0-9]{4}$/);
const imagePathSchema = z
  .string()
  .regex(/^images\/img_[0-9]{4}\.png$/)
  .refine((value) => !value.includes("..") && !value.includes("//"), {
    message: "benchmark paths must stay inside their package directory",
  });
const referencePathSchema = z
  .string()
  .regex(/^refs\/(?:[a-zA-Z0-9][a-zA-Z0-9._-]*\/)*[a-zA-Z0-9][a-zA-Z0-9._-]*\.png$/)
  .refine((value) => !value.includes("..") && !value.includes("//"), {
    message: "reference paths must stay inside refs",
  });
const intendedPathSchema = z
  .string()
  .regex(/^intended\/img_[0-9]{4}\.json$/)
  .refine((value) => !value.includes("..") && !value.includes("//"), {
    message: "intended paths must stay inside intended",
  });

export const qualityBenchmarkImageProfileSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/),
    width: z.number().int().positive().max(16_384),
    height: z.number().int().positive().max(16_384),
    source: z.literal("production_pipeline"),
  })
  .strict();

export const qualityBenchmarkManifestSchema = z
  .object({
    benchmark_version: z.literal(QUALITY_BENCHMARK_VERSION),
    dataset_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/),
    suite: z.literal("candidate"),
    split: z.enum(["dev", "holdout_private"]),
    review_version: z.string().trim().min(1).max(80),
    image_profiles: z.array(qualityBenchmarkImageProfileSchema).min(1),
    images: z
      .array(
        z
          .object({
            id: caseIdSchema,
            file: imagePathSchema,
            sha256: sha256Schema,
            image_profile_id: z.string().min(1).max(80),
          })
          .strict(),
      )
      .max(112),
  })
  .strict()
  .superRefine((value, context) => {
    const profileIds = new Set(value.image_profiles.map((profile) => profile.id));
    const ids = value.images.map((image) => image.id);
    const paths = value.images.map((image) => image.file);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", path: ["images"], message: "image IDs must be unique" });
    if (new Set(paths).size !== paths.length)
      context.addIssue({ code: "custom", path: ["images"], message: "image paths must be unique" });
    value.images.forEach((image, index) => {
      if (!profileIds.has(image.image_profile_id))
        context.addIssue({
          code: "custom",
          path: ["images", index, "image_profile_id"],
          message: "image profile must be declared by the manifest",
        });
    });
  });

export const qualityBenchmarkCaseSchema = z
  .object({
    id: caseIdSchema,
    file: imagePathSchema,
    suite: z.literal("candidate"),
    judge_mode: z.enum(["intrinsic", "referential"]),
    image_profile_id: z.string().min(1).max(80),
    refs: z.array(referencePathSchema).max(12),
    intended: intendedPathSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.judge_mode === "referential" && value.refs.length === 0)
      context.addIssue({
        code: "custom",
        path: ["refs"],
        message: "referential cases require at least one reference",
      });
    if (value.judge_mode === "intrinsic" && value.refs.length > 0)
      context.addIssue({
        code: "custom",
        path: ["refs"],
        message: "intrinsic cases cannot carry reference images",
      });
  });

export const qualityBenchmarkCasesSchema = z
  .array(qualityBenchmarkCaseSchema)
  .max(112)
  .superRefine((value, context) => {
    const ids = value.map((item) => item.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", message: "case IDs must be unique" });
  });

export const qualityBenchmarkIntendedSchema = z
  .object({
    schemaVersion: z.literal(1),
    panelSpecification: panelSpecificationSchema,
    referenceBindings: z
      .array(
        z
          .object({
            referenceId: z.string().uuid(),
            file: referencePathSchema,
          })
          .strict(),
      )
      .max(12),
  })
  .strict();

const verdictSchema = z.enum(["good", "bad", "borderline"]);

export const qualityBenchmarkPrivateLabelSchema = z
  .object({
    id: caseIdSchema,
    verdict: verdictSchema,
    defects: z
      .array(
        z
          .object({
            category: z.enum(QUALITY_BENCHMARK_DEFECT_CATEGORIES),
            severity: z.enum(["minor", "major", "critical"]),
            bbox: z.tuple([
              z.number().min(0).max(1),
              z.number().min(0).max(1),
              z.number().positive().max(1),
              z.number().positive().max(1),
            ]).optional(),
            note: z.string().trim().min(1).max(1_000).optional(),
          })
          .strict()
          .superRefine((defect, context) => {
            if (defect.bbox && defect.bbox[0] + defect.bbox[2] > 1)
              context.addIssue({ code: "custom", path: ["bbox"], message: "bbox exceeds image width" });
            if (defect.bbox && defect.bbox[1] + defect.bbox[3] > 1)
              context.addIssue({ code: "custom", path: ["bbox"], message: "bbox exceeds image height" });
          }),
      )
      .max(24),
    reviewed_by: z
      .array(z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/))
      .min(2)
      .max(10),
    reviewed_at: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
  })
  .strict()
  .superRefine((value, context) => {
    const reviewerIds = value.reviewed_by;
    if (new Set(reviewerIds).size !== reviewerIds.length)
      context.addIssue({ code: "custom", path: ["reviewed_by"], message: "reviewers must be unique" });
    if (value.verdict === "good" && value.defects.length > 0)
      context.addIssue({ code: "custom", path: ["defects"], message: "good cases cannot have defects" });
    if (value.verdict === "bad" && value.defects.length === 0)
      context.addIssue({ code: "custom", path: ["defects"], message: "bad cases require at least one defect" });
  });

export const qualityBenchmarkPrivateLabelsSchema = z
  .array(qualityBenchmarkPrivateLabelSchema)
  .max(112)
  .superRefine((value, context) => {
    const ids = value.map((label) => label.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", message: "label IDs must be unique" });
  });

export type QualityBenchmarkManifest = z.infer<typeof qualityBenchmarkManifestSchema>;
export type QualityBenchmarkCases = z.infer<typeof qualityBenchmarkCasesSchema>;
export type QualityBenchmarkPrivateLabels = z.infer<typeof qualityBenchmarkPrivateLabelsSchema>;

/** Evaluator-only joined record. Never serialize this object into a public package. */
export type QualityBenchmarkFixture = {
  id: string;
  panelSpecification: z.infer<typeof panelSpecificationSchema>;
  labels: {
    adoptable: boolean;
    failureCategories: VisualJudgeFailureCategory[];
    severity: "minor" | "major" | "critical";
  };
};

export type QualityBenchmarkPackage = {
  manifest: QualityBenchmarkManifest;
  cases: QualityBenchmarkCases;
  privateLabels: QualityBenchmarkPrivateLabels;
};

function inspectSplit(packageData: QualityBenchmarkPackage) {
  const target = QUALITY_BENCHMARK_SPLIT_TARGETS[packageData.manifest.split];
  const labelsById = new Map(packageData.privateLabels.map((label) => [label.id, label]));
  const counts = { good: 0, bad: 0, borderline: 0 };
  const profileCounts: Record<string, { good: number; bad: number; borderline: number }> = {};
  for (const image of packageData.manifest.images) {
    const verdict = labelsById.get(image.id)?.verdict;
    if (!verdict) continue;
    counts[verdict] += 1;
    profileCounts[image.image_profile_id] ??= { good: 0, bad: 0, borderline: 0 };
    profileCounts[image.image_profile_id][verdict] += 1;
  }
  const manifestIds = new Set(packageData.manifest.images.map((image) => image.id));
  const caseIds = new Set(packageData.cases.map((item) => item.id));
  const labelIds = new Set(packageData.privateLabels.map((label) => label.id));
  const sameIds =
    manifestIds.size === caseIds.size &&
    manifestIds.size === labelIds.size &&
    [...manifestIds].every((id) => caseIds.has(id) && labelIds.has(id));
  const profileBalanceReady = Object.values(profileCounts).every(
    (profile) => Math.abs(profile.good - profile.bad) <= 1,
  );
  const exactTargetReady = Object.entries(target).every(
    ([verdict, expected]) => counts[verdict as keyof typeof counts] === expected,
  );
  const reviewedLabels = packageData.privateLabels;
  const independentReviewReady = reviewedLabels.every(
    (label) => new Set(label.reviewed_by).size >= 2,
  );
  const verdictsByHash = new Map<string, Set<string>>();
  for (const image of packageData.manifest.images) {
    const verdict = labelsById.get(image.id)?.verdict;
    if (!verdict) continue;
    const verdicts = verdictsByHash.get(image.sha256) ?? new Set<string>();
    verdicts.add(verdict);
    verdictsByHash.set(image.sha256, verdicts);
  }
  const noCrossLabelDuplicates = [...verdictsByHash.values()].every(
    (verdicts) => verdicts.size === 1,
  );
  return {
    counts,
    target,
    sameIds,
    profileCounts,
    profileBalanceReady,
    exactTargetReady,
    independentReviewReady,
    noCrossLabelDuplicates,
  };
}

export function inspectQualityBenchmarkReadiness(input: {
  dev: QualityBenchmarkPackage;
  holdout: QualityBenchmarkPackage;
}) {
  const dev = inspectSplit(input.dev);
  const holdout = inspectSplit(input.holdout);
  const categoryCounts = Object.fromEntries(
    Object.entries(QUALITY_BENCHMARK_DEFECT_GROUPS).map(([group, categories]) => [
      group,
      [...input.dev.privateLabels, ...input.holdout.privateLabels].filter(
        (label) =>
          label.verdict === "bad" &&
          label.defects.some((defect) =>
            (categories as readonly string[]).includes(defect.category),
          ),
      ).length,
    ]),
  ) as Record<keyof typeof QUALITY_BENCHMARK_DEFECT_GROUPS, number>;
  const missingCategoryCases = Object.fromEntries(
    Object.entries(categoryCounts)
      .map(([category, count]) => [category, Math.max(0, 10 - count)])
      .filter(([, missing]) => Number(missing) > 0),
  );
  const devHashes = new Set(input.dev.manifest.images.map((image) => image.sha256));
  const noCrossSplitDuplicates = input.holdout.manifest.images.every(
    (image) => !devHashes.has(image.sha256),
  );
  const labelsPrivate =
    input.dev.cases.every((item) => !("labels" in item) && !("verdict" in item) && !("defects" in item)) &&
    input.holdout.cases.every((item) => !("labels" in item) && !("verdict" in item) && !("defects" in item));
  const ready =
    dev.exactTargetReady &&
    holdout.exactTargetReady &&
    dev.sameIds &&
    holdout.sameIds &&
    dev.profileBalanceReady &&
    holdout.profileBalanceReady &&
    dev.independentReviewReady &&
    holdout.independentReviewReady &&
    dev.noCrossLabelDuplicates &&
    holdout.noCrossLabelDuplicates &&
    noCrossSplitDuplicates &&
    labelsPrivate &&
    Object.keys(missingCategoryCases).length === 0;
  return {
    ready,
    dev,
    holdout,
    categoryCounts,
    missingCategoryCases,
    noCrossSplitDuplicates,
    labelsPrivate,
  };
}
