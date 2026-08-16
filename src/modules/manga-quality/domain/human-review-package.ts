import { z } from "zod";
import { panelSpecificationSchema } from "./panel-specification.ts";
import {
  qualityBenchmarkCaseIdSchema,
  qualityBenchmarkSha256Schema,
} from "./quality-benchmark-fixture.ts";

export const HUMAN_REVIEW_PACKAGE_VERSION = "mangai-review-package-v2" as const;
export const HUMAN_REVIEW_TEMPLATE_VERSION = "mangai-human-review-v2" as const;

export const HUMAN_REVIEW_DEFECT_CATEGORIES = [
  "character_identity_mismatch",
  "character_count_mismatch",
  "expression_mismatch",
  "anatomy_hand_error",
  "anatomy_body_distortion",
  "object_fusion",
  "unwanted_text",
  "unwanted_ui",
  "unwanted_logo",
  "composition_mismatch",
  "crop_error",
  "orientation_error",
  "gravity_error",
  "background_mismatch",
  "prop_missing",
  "prop_mismatch",
  "style_inconsistency",
  "low_readability",
  "other",
] as const;

export const INTRINSIC_REVIEW_DEFECT_CATEGORIES = [
  "anatomy_hand_error",
  "anatomy_body_distortion",
  "object_fusion",
  "unwanted_text",
  "unwanted_ui",
  "unwanted_logo",
  "crop_error",
  "orientation_error",
  "gravity_error",
  "low_readability",
  "other",
] as const;

export const humanReviewModeSchema = z.enum(["intrinsic_only", "referential"]);
export const humanReviewCaseIdSchema = z.string().regex(/^case_[0-9]{6}$/);
export const humanReviewSlotSchema = z.enum(["reviewer_a", "reviewer_b"]);
export const humanReviewVerdictSchema = z.enum(["good", "bad", "borderline"]);
export const humanReviewDefectCategorySchema = z.enum(HUMAN_REVIEW_DEFECT_CATEGORIES);
export const humanReviewSeveritySchema = z.enum(["minor", "major", "critical"]);

const reviewerIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/);
const packageIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/);
const sourceGroupIdSchema = z.string().regex(/^srcgrp_[a-z0-9][a-z0-9_-]{0,63}$/);
const sourceFamilySchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/);
const nullableGroupIdSchema = z.string().regex(/^(?:chargrp|refgrp)_[a-z0-9][a-z0-9_-]{0,63}$/).nullable();
const targetSplitSchema = z.enum(["dev", "holdout_private", "pilot_unassigned"]);
const safeRelativeFileSchema = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => !value.includes("\\") && !value.startsWith("/") && !value.split("/").includes(".."), {
    message: "file path must stay inside the private benchmark root",
  });

export const humanReviewBboxSchema = z
  .tuple([
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().positive().max(1),
    z.number().positive().max(1),
  ])
  .superRefine((bbox, context) => {
    if (bbox[0] + bbox[2] > 1)
      context.addIssue({ code: "custom", message: "bbox exceeds image width" });
    if (bbox[1] + bbox[3] > 1)
      context.addIssue({ code: "custom", message: "bbox exceeds image height" });
  });

export const humanReviewDefectSchema = z
  .object({
    category: humanReviewDefectCategorySchema,
    severity: humanReviewSeveritySchema,
    bbox: humanReviewBboxSchema.nullable().optional(),
    comment: z.string().trim().max(1_000).default(""),
  })
  .strict();

export const humanReviewRecordSchema = z
  .object({
    case_id: humanReviewCaseIdSchema,
    verdict: humanReviewVerdictSchema,
    confidence: z.number().int().min(1).max(5),
    defects: z.array(humanReviewDefectSchema).max(30),
    overall_comment: z.string().trim().max(2_000).default(""),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.verdict === "good" && value.defects.length > 0)
      context.addIssue({ code: "custom", path: ["defects"], message: "good cases cannot have defects" });
    if (value.verdict === "bad" && value.defects.length === 0)
      context.addIssue({ code: "custom", path: ["defects"], message: "bad cases require at least one defect" });
    if (value.verdict === "borderline" && value.defects.length === 0 && value.overall_comment.length === 0)
      context.addIssue({ code: "custom", path: ["overall_comment"], message: "borderline cases require a defect or comment" });
  });

export const humanReviewResponseSchema = z
  .object({
    template_version: z.literal(HUMAN_REVIEW_TEMPLATE_VERSION),
    slot: humanReviewSlotSchema,
    reviewer_id: reviewerIdSchema,
    reviewer_kind: z.literal("human"),
    independent: z.literal(true),
    reviewed_at: z.iso.datetime({ offset: true }),
    records: z.array(humanReviewRecordSchema).min(1).max(140),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.records.map((record) => record.case_id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", path: ["records"], message: "case IDs must be unique" });
  });

export const humanReviewResponseTemplateSchema = z
  .object({
    template_version: z.literal(HUMAN_REVIEW_TEMPLATE_VERSION),
    slot: humanReviewSlotSchema,
    reviewer_id: z.literal(""),
    reviewer_kind: z.literal("human"),
    independent: z.literal(true),
    reviewed_at: z.literal(""),
    records: z.array(z.object({
      case_id: humanReviewCaseIdSchema,
      verdict: z.null(),
      confidence: z.null(),
      defects: z.array(z.never()).length(0),
      overall_comment: z.literal(""),
    }).strict()).min(1).max(140),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.records.map((record) => record.case_id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", path: ["records"], message: "case IDs must be unique" });
  });

export const humanReviewAiAuditSchema = z.object({
  template_version: z.literal("mangai-ai-audit-v1"),
  auditor_id: reviewerIdSchema,
  reviewer_kind: z.literal("ai_audit"),
  reviewed_at: z.iso.datetime({ offset: true }),
  records: z.array(humanReviewRecordSchema).min(1).max(140),
}).strict();

/** Explicit evaluator mapping only. Runtime MangaQualityFailureCategory remains independent. */
export const HUMAN_REVIEW_TO_BENCHMARK_DEFECT_CATEGORY = {
  character_identity_mismatch: "character_identity_mismatch",
  character_count_mismatch: "character_identity_mismatch",
  expression_mismatch: "character_identity_mismatch",
  anatomy_hand_error: "anatomy_object_fusion",
  anatomy_body_distortion: "anatomy_object_fusion",
  object_fusion: "anatomy_object_fusion",
  unwanted_text: "unwanted_text_ui_logo",
  unwanted_ui: "unwanted_text_ui_logo",
  unwanted_logo: "unwanted_text_ui_logo",
  composition_mismatch: "composition_mismatch",
  crop_error: "composition_crop_error",
  orientation_error: "orientation_gravity_error",
  gravity_error: "orientation_gravity_error",
  background_mismatch: "background_prop_mismatch",
  prop_missing: "background_prop_mismatch",
  prop_mismatch: "background_prop_mismatch",
  style_inconsistency: null,
  low_readability: null,
  other: null,
} as const satisfies Record<
  (typeof HUMAN_REVIEW_DEFECT_CATEGORIES)[number],
  | "character_identity_mismatch"
  | "anatomy_object_fusion"
  | "unwanted_text_ui_logo"
  | "composition_mismatch"
  | "composition_crop_error"
  | "orientation_gravity_error"
  | "background_prop_mismatch"
  | null
>;

const packageReferenceSchema = z.object({
  reference_id: z.string().regex(/^ref_[0-9]{2}$/),
  role: z.enum(["character_identity", "character_expression", "character_full_body", "location", "prop", "other"]),
  binding_id: z.string().uuid().nullable(),
  file: z.string().regex(/^cases\/case_[0-9]{6}\/references\/ref_[0-9]{2}\.(?:png|jpe?g|webp)$/),
  sha256: qualityBenchmarkSha256Schema,
}).strict();

export const humanReviewPackageCaseSchema = z
  .object({
    case_id: humanReviewCaseIdSchema,
    review_mode: humanReviewModeSchema,
    candidate_file: z.string().regex(/^cases\/case_[0-9]{6}\/candidate\.(?:png|jpe?g|webp)$/),
    candidate_sha256: qualityBenchmarkSha256Schema,
    intended_file: z.string().regex(/^cases\/case_[0-9]{6}\/intended\.json$/).nullable(),
    intended_sha256: qualityBenchmarkSha256Schema.nullable(),
    references: z.array(packageReferenceSchema).max(12),
    allowed_defect_categories: z.array(humanReviewDefectCategorySchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const prefix = `cases/${value.case_id}/`;
    if (!value.candidate_file.startsWith(prefix))
      context.addIssue({ code: "custom", path: ["candidate_file"], message: "candidate path must match case ID" });
    if (value.intended_file && !value.intended_file.startsWith(prefix))
      context.addIssue({ code: "custom", path: ["intended_file"], message: "intended path must match case ID" });
    if ((value.intended_file === null) !== (value.intended_sha256 === null))
      context.addIssue({ code: "custom", path: ["intended_sha256"], message: "intended path and checksum must be present together" });
    if (value.review_mode === "intrinsic_only") {
      if (value.references.length > 0 || value.intended_file !== null)
        context.addIssue({ code: "custom", message: "intrinsic review must remain image-only" });
      const invalid = value.allowed_defect_categories.filter(
        (category) => !(INTRINSIC_REVIEW_DEFECT_CATEGORIES as readonly string[]).includes(category),
      );
      if (invalid.length > 0)
        context.addIssue({ code: "custom", path: ["allowed_defect_categories"], message: "intrinsic review contains referential categories" });
    } else {
      if (!value.intended_file)
        context.addIssue({ code: "custom", path: ["intended_file"], message: "referential review requires intended.json" });
      if (value.references.length === 0)
        context.addIssue({ code: "custom", path: ["references"], message: "referential review requires references" });
      const allowsIdentity = value.allowed_defect_categories.includes("character_identity_mismatch");
      const hasIdentityReference = value.references.some((reference) => reference.role.startsWith("character_") && reference.binding_id);
      if (allowsIdentity && !hasIdentityReference)
        context.addIssue({ code: "custom", path: ["allowed_defect_categories"], message: "identity mismatch requires a character reference" });
    }
    const expectedCategories = allowedDefectCategoriesForCase({
      reviewMode: value.review_mode,
      referenceRoles: value.references.map((reference) => reference.role),
    });
    if (
      new Set(value.allowed_defect_categories).size !== value.allowed_defect_categories.length ||
      value.allowed_defect_categories.length !== expectedCategories.length ||
      expectedCategories.some((category) => !value.allowed_defect_categories.includes(category))
    )
      context.addIssue({ code: "custom", path: ["allowed_defect_categories"], message: "allowed categories must match review context" });
    const referenceIds = value.references.map((reference) => reference.reference_id);
    const referenceFiles = value.references.map((reference) => reference.file);
    if (new Set(referenceIds).size !== referenceIds.length || new Set(referenceFiles).size !== referenceFiles.length)
      context.addIssue({ code: "custom", path: ["references"], message: "references must be unique" });
  });

export const humanReviewPackageManifestSchema = z
  .object({
    package_version: z.literal(HUMAN_REVIEW_PACKAGE_VERSION),
    benchmark_version: z.literal("2.1"),
    package_id: packageIdSchema,
    slot: humanReviewSlotSchema,
    package_status: z.enum(["PILOT_PACKAGE_STRUCTURE_READY", "FORMAL_REVIEW_READY"]),
    review_scope: z.enum(["PILOT_INTRINSIC_ONLY", "FORMAL_CANDIDATE"]),
    formal_benchmark_eligible: z.boolean(),
    case_count: z.number().int().min(1).max(140),
    cases: z.array(humanReviewPackageCaseSchema).min(1).max(140),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.cases.map((item) => item.case_id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", path: ["cases"], message: "case IDs must be unique" });
    if (value.case_count !== value.cases.length)
      context.addIssue({ code: "custom", path: ["case_count"], message: "case count must match cases" });
    if (value.review_scope === "PILOT_INTRINSIC_ONLY") {
      if (value.package_status !== "PILOT_PACKAGE_STRUCTURE_READY" || value.formal_benchmark_eligible)
        context.addIssue({ code: "custom", message: "pilot package cannot be formal benchmark eligible" });
      if (value.cases.some((item) => item.review_mode !== "intrinsic_only"))
        context.addIssue({ code: "custom", path: ["cases"], message: "pilot scope accepts intrinsic-only cases" });
    }
  });

const privateReferenceSchema = z.object({
  reference_id: z.string().regex(/^ref_[0-9]{2}$/),
  role: packageReferenceSchema.shape.role,
  character_index: z.number().int().min(0).max(11).nullable(),
  file: safeRelativeFileSchema,
}).strict().superRefine((value, context) => {
  if (value.role.startsWith("character_") && value.character_index === null)
    context.addIssue({ code: "custom", path: ["character_index"], message: "character references require a character index" });
  if (!value.role.startsWith("character_") && value.character_index !== null)
    context.addIssue({ code: "custom", path: ["character_index"], message: "non-character references cannot bind to a character" });
});

export const humanReviewPackageSourceSchema = z.object({
  source_version: z.literal(1),
  benchmark_version: z.literal("2.1"),
  package_id: packageIdSchema,
  review_scope: z.enum(["PILOT_INTRINSIC_ONLY", "FORMAL_CANDIDATE"]),
  formal_benchmark_eligible: z.boolean(),
  cases: z.array(z.object({
    source_case_id: qualityBenchmarkCaseIdSchema,
    review_case_id: humanReviewCaseIdSchema,
    candidate_file: safeRelativeFileSchema,
    review_mode: humanReviewModeSchema,
    intended_file: safeRelativeFileSchema.nullable(),
    references: z.array(privateReferenceSchema).max(12),
    source_group_id: sourceGroupIdSchema,
    source_family: sourceFamilySchema,
    character_group_id: nullableGroupIdSchema,
    reference_group_id: nullableGroupIdSchema,
    target_split: targetSplitSchema,
  }).strict()).min(1).max(140),
}).strict().superRefine((value, context) => {
  const sourceIds = value.cases.map((item) => item.source_case_id);
  const reviewIds = value.cases.map((item) => item.review_case_id);
  if (new Set(sourceIds).size !== sourceIds.length)
    context.addIssue({ code: "custom", path: ["cases"], message: "source case IDs must be unique" });
  if (new Set(reviewIds).size !== reviewIds.length)
    context.addIssue({ code: "custom", path: ["cases"], message: "review case IDs must be unique" });
  if (value.review_scope === "PILOT_INTRINSIC_ONLY") {
    if (value.formal_benchmark_eligible)
      context.addIssue({ code: "custom", message: "pilot source cannot be formal benchmark eligible" });
    if (value.cases.some((item) => item.review_mode !== "intrinsic_only" || item.target_split !== "pilot_unassigned"))
      context.addIssue({ code: "custom", path: ["cases"], message: "pilot cases must remain intrinsic and unassigned" });
  }
  const splitsByFamily = new Map<string, Set<string>>();
  value.cases.forEach((item, index) => {
    const splits = splitsByFamily.get(item.source_family) ?? new Set<string>();
    splits.add(item.target_split);
    splitsByFamily.set(item.source_family, splits);
    if (item.review_mode === "intrinsic_only" && (item.references.length > 0 || item.intended_file !== null))
      context.addIssue({ code: "custom", path: ["cases", index], message: "intrinsic package must not expose referential context" });
    if (item.review_mode === "referential" && (!item.intended_file || item.references.length === 0))
      context.addIssue({ code: "custom", path: ["cases", index], message: "referential package requires intended and references" });
  });
  if ([...splitsByFamily.values()].some((splits) => splits.has("dev") && splits.has("holdout_private")))
    context.addIssue({ code: "custom", path: ["cases"], message: "source family cannot cross dev and holdout" });
});

export const humanReviewPackageSourceSidecarSchema = z.object({
  source_version: z.literal(1),
  package_id: packageIdSchema,
  package_sha256: qualityBenchmarkSha256Schema,
  review_scope: z.enum(["PILOT_INTRINSIC_ONLY", "FORMAL_CANDIDATE"]),
  formal_benchmark_eligible: z.boolean(),
  formal_benchmark_status: z.enum(["NOT_COUNTED_IN_FORMAL_BENCHMARK", "AWAITING_DUAL_HUMAN_REVIEW"]),
  cases: z.array(z.object({
    case_id: humanReviewCaseIdSchema,
    source_case_id: qualityBenchmarkCaseIdSchema,
    source_group_id: sourceGroupIdSchema,
    source_family: sourceFamilySchema,
    character_group_id: nullableGroupIdSchema,
    reference_group_id: nullableGroupIdSchema,
    target_split: targetSplitSchema,
  }).strict()).min(1).max(140),
}).strict().superRefine((value, context) => {
  const caseIds = value.cases.map((item) => item.case_id);
  const sourceIds = value.cases.map((item) => item.source_case_id);
  if (new Set(caseIds).size !== caseIds.length || new Set(sourceIds).size !== sourceIds.length)
    context.addIssue({ code: "custom", path: ["cases"], message: "sidecar case mappings must be unique" });
});

export const humanReviewPanelSpecificationSchema = panelSpecificationSchema;

export type HumanReviewPackageManifest = z.infer<typeof humanReviewPackageManifestSchema>;
export type HumanReviewPackageSource = z.infer<typeof humanReviewPackageSourceSchema>;
export type HumanReviewResponse = z.infer<typeof humanReviewResponseSchema>;

export function allowedDefectCategoriesForCase(input: {
  reviewMode: z.infer<typeof humanReviewModeSchema>;
  referenceRoles?: Array<z.infer<typeof packageReferenceSchema>["role"]>;
}) {
  if (input.reviewMode === "intrinsic_only") return [...INTRINSIC_REVIEW_DEFECT_CATEGORIES];
  const categories = [...HUMAN_REVIEW_DEFECT_CATEGORIES];
  if (!input.referenceRoles?.some((role) => role.startsWith("character_")))
    return categories.filter((category) => category !== "character_identity_mismatch");
  return categories;
}

export function validateHumanReviewResponseForPackage(
  responseInput: unknown,
  manifestInput: unknown,
) {
  const response = humanReviewResponseSchema.parse(responseInput);
  const manifest = humanReviewPackageManifestSchema.parse(manifestInput);
  const reasons: string[] = [];
  if (response.slot !== manifest.slot) reasons.push("reviewer_slot_mismatch");
  const casesById = new Map(manifest.cases.map((item) => [item.case_id, item]));
  const responseIds = new Set(response.records.map((record) => record.case_id));
  for (const item of manifest.cases)
    if (!responseIds.has(item.case_id)) reasons.push(`missing_case:${item.case_id}`);
  for (const record of response.records) {
    const item = casesById.get(record.case_id);
    if (!item) {
      reasons.push(`unknown_case:${record.case_id}`);
      continue;
    }
    for (const defect of record.defects)
      if (!item.allowed_defect_categories.includes(defect.category))
        reasons.push(`category_not_allowed:${record.case_id}:${defect.category}`);
  }
  return { valid: reasons.length === 0, reasons: [...new Set(reasons)], response, manifest };
}

function defectSignature(record: z.infer<typeof humanReviewRecordSchema>) {
  return record.defects
    .map((defect) => `${defect.category}:${defect.severity}`)
    .sort()
    .join("|");
}

export function compareHumanReviewResponses(
  reviewerAInput: unknown,
  reviewerBInput: unknown,
  manifestInput: unknown,
) {
  const a = validateHumanReviewResponseForPackage(reviewerAInput, { ...manifestInput as object, slot: "reviewer_a" });
  const b = validateHumanReviewResponseForPackage(reviewerBInput, { ...manifestInput as object, slot: "reviewer_b" });
  const reasons = [...a.reasons, ...b.reasons];
  if (a.response.reviewer_id === b.response.reviewer_id) reasons.push("human_reviewers_must_be_independent");
  const recordsA = new Map(a.response.records.map((record) => [record.case_id, record]));
  const records = b.response.records.map((recordB) => {
    const recordA = recordsA.get(recordB.case_id);
    if (!recordA) return { case_id: recordB.case_id, verdict_agreement: false, category_agreement: false, severity_agreement: false, adjudication_required: true };
    const categoriesA = recordA.defects.map((item) => item.category).sort().join("|");
    const categoriesB = recordB.defects.map((item) => item.category).sort().join("|");
    const verdictAgreement = recordA.verdict === recordB.verdict;
    const categoryAgreement = categoriesA === categoriesB;
    const severityAgreement = defectSignature(recordA) === defectSignature(recordB);
    return {
      case_id: recordB.case_id,
      verdict_agreement: verdictAgreement,
      category_agreement: categoryAgreement,
      severity_agreement: severityAgreement,
      adjudication_required: !(verdictAgreement && categoryAgreement && severityAgreement),
    };
  });
  return {
    valid: reasons.length === 0,
    reasons: [...new Set(reasons)],
    verdict_agreement_count: records.filter((record) => record.verdict_agreement).length,
    category_agreement_count: records.filter((record) => record.category_agreement).length,
    severity_agreement_count: records.filter((record) => record.severity_agreement).length,
    disagreement_count: records.filter((record) => record.adjudication_required).length,
    adjudication_required_count: records.filter((record) => record.adjudication_required).length,
    records,
  };
}
