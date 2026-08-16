import { z } from "zod";
import {
  QUALITY_BENCHMARK_VERSION,
  inspectQualityBenchmarkReadiness,
  qualityBenchmarkCaseIdSchema,
  qualityBenchmarkCasesSchema,
  qualityBenchmarkDefectSchema,
  qualityBenchmarkImageProfileSchema,
  qualityBenchmarkManifestSchema,
  qualityBenchmarkPrivateLabelsSchema,
  qualityBenchmarkSha256Schema,
  qualityBenchmarkVerdictSchema,
  type QualityBenchmarkPackage,
} from "./quality-benchmark-fixture.ts";

export const QUALITY_BENCHMARK_ASSEMBLY_VERSION = "1" as const;
export const QUALITY_BENCHMARK_ROOT_ENV = "MANGAI_QUALITY_BENCHMARK_ROOT" as const;

const reviewerIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/);
const familyIdSchema = z.string().regex(/^family_[0-9]{4}$/);
const sourceGroupIdSchema = z.string().regex(/^srcgrp_[a-z0-9][a-z0-9_-]{0,63}$/);
const sourceFamilySchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/);
const characterGroupIdSchema = z.string().regex(/^chargrp_[a-z0-9][a-z0-9_-]{0,63}$/).nullable();
const referenceGroupIdSchema = z.string().regex(/^refgrp_[a-z0-9][a-z0-9_-]{0,63}$/).nullable();
const rightsIdSchema = z.string().regex(/^rights_[0-9]{4}$/);
const sourceImagePathSchema = z.string().regex(/^assembly\/images\/img_[0-9]{4}\.png$/);
const sourceIntendedPathSchema = z.string().regex(/^assembly\/intended\/img_[0-9]{4}\.json$/);
const sourceReferencePathSchema = z
  .string()
  .regex(/^assembly\/refs\/ref_[0-9]{4}(?:_[0-9]{2})?\.png$/);
const rightsEvidencePathSchema = z.string().regex(/^assembly\/rights\/rights_[0-9]{4}\.json$/);

const reviewedVerdictSchema = z
  .object({
    verdict: qualityBenchmarkVerdictSchema,
    defects: z.array(qualityBenchmarkDefectSchema).max(24),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.verdict === "good" && value.defects.length > 0)
      context.addIssue({ code: "custom", path: ["defects"], message: "good cases cannot have defects" });
    if (value.verdict === "bad" && value.defects.length === 0)
      context.addIssue({ code: "custom", path: ["defects"], message: "bad cases require defects" });
  });

export const qualityBenchmarkAssemblyManifestSchema = z
  .object({
    assembly_version: z.literal(QUALITY_BENCHMARK_ASSEMBLY_VERSION),
    benchmark_version: z.literal(QUALITY_BENCHMARK_VERSION),
    dataset_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,59}$/),
    suite: z.literal("candidate"),
    review_version: z.string().trim().min(1).max(80),
    image_profiles: z.array(qualityBenchmarkImageProfileSchema).min(1),
    items: z.array(z.object({
      id: qualityBenchmarkCaseIdSchema,
      family_id: familyIdSchema,
      source_group_id: sourceGroupIdSchema,
      source_family: sourceFamilySchema,
      character_group_id: characterGroupIdSchema,
      reference_group_id: referenceGroupIdSchema,
      split: z.enum(["dev", "holdout_private"]),
      source_file: sourceImagePathSchema,
      sha256: qualityBenchmarkSha256Schema,
      image_profile_id: z.string().min(1).max(80),
      judge_mode: z.enum(["intrinsic", "referential"]),
      refs: z.array(sourceReferencePathSchema).max(12),
      intended: sourceIntendedPathSchema,
      rights_record_id: rightsIdSchema,
      derivation: z.literal("independent_original_case"),
    }).strict()).max(140),
  })
  .strict()
  .superRefine((value, context) => {
    const profileIds = new Set(value.image_profiles.map((profile) => profile.id));
    const ids = value.items.map((item) => item.id);
    const files = value.items.map((item) => item.source_file);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", path: ["items"], message: "case IDs must be unique" });
    if (new Set(files).size !== files.length)
      context.addIssue({ code: "custom", path: ["items"], message: "source files must be unique" });
    value.items.forEach((item, index) => {
      if (!profileIds.has(item.image_profile_id))
        context.addIssue({ code: "custom", path: ["items", index, "image_profile_id"], message: "unknown image profile" });
      if (item.judge_mode === "referential" && item.refs.length === 0)
        context.addIssue({ code: "custom", path: ["items", index, "refs"], message: "referential cases require refs" });
      if (item.judge_mode === "intrinsic" && item.refs.length > 0)
        context.addIssue({ code: "custom", path: ["items", index, "refs"], message: "intrinsic cases cannot carry refs" });
      if (!item.source_file.endsWith(`${item.id}.png`) || !item.intended.endsWith(`${item.id}.json`))
        context.addIssue({ code: "custom", path: ["items", index], message: "case ID must match source paths" });
    });
  });

export const qualityBenchmarkRightsLedgerSchema = z.object({
  assembly_version: z.literal(QUALITY_BENCHMARK_ASSEMBLY_VERSION),
  records: z.array(z.object({
    id: rightsIdSchema,
    case_id: qualityBenchmarkCaseIdSchema,
    status: z.literal("verified"),
    basis: z.enum(["original_owned", "commissioned_with_benchmark_rights", "licensed_for_evaluation"]),
    benchmark_use_permitted: z.literal(true),
    verified_by: reviewerIdSchema,
    verified_at: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
    evidence_file: rightsEvidencePathSchema,
    screening: z.object({
      customer_content: z.literal(false),
      production_content: z.literal(false),
      monitor_content: z.literal(false),
      adult_content: z.literal(false),
      personal_information: z.literal(false),
      v1_reuse: z.literal(false),
      placeholder_image: z.literal(false),
      trivial_transform_or_crop: z.literal(false),
    }).strict(),
  }).strict()).max(140),
}).strict();

const independentReviewSchema = reviewedVerdictSchema.extend({
  slot: z.enum(["reviewer_a", "reviewer_b"]),
  reviewer_id: reviewerIdSchema,
  reviewer_kind: z.literal("human"),
  independent: z.literal(true),
  reviewed_at: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
}).strict();

const adjudicationSchema = reviewedVerdictSchema.extend({
  adjudicator_id: reviewerIdSchema,
  adjudicator_kind: z.literal("human"),
  decided_at: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
  reason: z.string().trim().min(1).max(500),
}).strict();

export const qualityBenchmarkReviewLedgerSchema = z.object({
  assembly_version: z.literal(QUALITY_BENCHMARK_ASSEMBLY_VERSION),
  protocol: z.literal("human-dual-v1"),
  records: z.array(z.object({
    case_id: qualityBenchmarkCaseIdSchema,
    reviews: z.array(independentReviewSchema).length(2),
    adjudication: adjudicationSchema.optional(),
  }).strict().superRefine((value, context) => {
    if (new Set(value.reviews.map((review) => review.slot)).size !== 2)
      context.addIssue({ code: "custom", path: ["reviews"], message: "reviewer_a and reviewer_b are required" });
    if (new Set(value.reviews.map((review) => review.reviewer_id)).size !== 2)
      context.addIssue({ code: "custom", path: ["reviews"], message: "reviewers must be unique" });
    if (value.adjudication && value.reviews.some((review) => review.reviewer_id === value.adjudication?.adjudicator_id))
      context.addIssue({ code: "custom", path: ["adjudication"], message: "adjudicator must be independent" });
  })).max(140),
}).strict();

export type QualityBenchmarkAssemblyManifest = z.infer<typeof qualityBenchmarkAssemblyManifestSchema>;
export type QualityBenchmarkRightsLedger = z.infer<typeof qualityBenchmarkRightsLedgerSchema>;
export type QualityBenchmarkReviewLedger = z.infer<typeof qualityBenchmarkReviewLedgerSchema>;

function reviewSignature(review: z.infer<typeof reviewedVerdictSchema>) {
  const defects = review.defects
    .map((defect) => `${defect.category}:${defect.severity}`)
    .sort();
  return JSON.stringify([review.verdict, defects]);
}

function calculateReviewAgreement(records: QualityBenchmarkReviewLedger["records"]) {
  if (records.length === 0) return { agreement: 0, kappa: 0 };
  const verdicts = ["good", "bad", "borderline"] as const;
  const agreed = records.filter((record) => reviewSignature(record.reviews[0]) === reviewSignature(record.reviews[1])).length;
  const marginal = verdicts.map((verdict) => [0, 1].map((slot) =>
    records.filter((record) => record.reviews[slot].verdict === verdict).length / records.length,
  ));
  const observed = records.filter((record) => record.reviews[0].verdict === record.reviews[1].verdict).length / records.length;
  const expected = marginal.reduce((sum, pair) => sum + pair[0] * pair[1], 0);
  return {
    agreement: agreed / records.length,
    kappa: expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected),
  };
}

function compilePackage(
  manifest: QualityBenchmarkAssemblyManifest,
  records: QualityBenchmarkReviewLedger["records"],
  split: "dev" | "holdout_private",
): QualityBenchmarkPackage {
  const reviewById = new Map(records.map((record) => [record.case_id, record]));
  const items = manifest.items.filter((item) => item.split === split);
  const images = items.map((item) => ({
    id: item.id,
    file: `images/${item.id}.png`,
    sha256: item.sha256,
    image_profile_id: item.image_profile_id,
  }));
  const packageManifest = qualityBenchmarkManifestSchema.parse({
    benchmark_version: QUALITY_BENCHMARK_VERSION,
    dataset_id: `${manifest.dataset_id}-${split === "dev" ? "dev" : "holdout"}`,
    suite: "candidate",
    split,
    review_version: manifest.review_version,
    image_profiles: manifest.image_profiles,
    images,
  });
  const cases = qualityBenchmarkCasesSchema.parse(items.map((item) => ({
    id: item.id,
    file: `images/${item.id}.png`,
    suite: "candidate",
    judge_mode: item.judge_mode,
    image_profile_id: item.image_profile_id,
    refs: item.refs.map((reference) => reference.replace(/^assembly\//, "")),
    intended: item.intended.replace(/^assembly\//, ""),
  })));
  const privateLabels = qualityBenchmarkPrivateLabelsSchema.parse(items.map((item) => {
    const record = reviewById.get(item.id);
    if (!record) throw new Error(`review_missing:${item.id}`);
    const chosen = record.adjudication ?? record.reviews[0];
    return {
      id: item.id,
      verdict: chosen.verdict,
      defects: chosen.defects,
      reviewed_by: [
        ...record.reviews.map((review) => review.reviewer_id),
        ...(record.adjudication ? [record.adjudication.adjudicator_id] : []),
      ],
      reviewed_at: record.adjudication?.decided_at ?? record.reviews.map((review) => review.reviewed_at).sort().at(-1),
    };
  }));
  return { manifest: packageManifest, cases, privateLabels };
}

export function inspectQualityBenchmarkAssembly(input: {
  manifest: QualityBenchmarkAssemblyManifest;
  rights: QualityBenchmarkRightsLedger;
  reviews: QualityBenchmarkReviewLedger;
}) {
  const reasons: string[] = [];
  const itemIds = new Set(input.manifest.items.map((item) => item.id));
  const rightsById = new Map(input.rights.records.map((record) => [record.id, record]));
  const reviewIds = input.reviews.records.map((record) => record.case_id);
  if (input.manifest.items.length !== 140) reasons.push("fixture_count_must_equal_140");
  if (new Set(input.rights.records.map((record) => record.id)).size !== input.rights.records.length)
    reasons.push("rights_ids_must_be_unique");
  if (new Set(reviewIds).size !== reviewIds.length) reasons.push("review_case_ids_must_be_unique");
  if (input.rights.records.length !== itemIds.size || input.reviews.records.length !== itemIds.size)
    reasons.push("assembly_rights_review_sets_must_match");
  for (const item of input.manifest.items) {
    const rights = rightsById.get(item.rights_record_id);
    if (!rights || rights.case_id !== item.id) reasons.push(`rights_missing:${item.id}`);
    if (!reviewIds.includes(item.id)) reasons.push(`review_missing:${item.id}`);
  }
  for (const rights of input.rights.records)
    if (!itemIds.has(rights.case_id)) reasons.push(`rights_orphan:${rights.case_id}`);
  for (const caseId of reviewIds)
    if (!itemIds.has(caseId)) reasons.push(`review_orphan:${caseId}`);

  const splitByFamily = new Map<string, Set<string>>();
  const splitBySourceFamily = new Map<string, Set<string>>();
  for (const item of input.manifest.items) {
    const splits = splitByFamily.get(item.family_id) ?? new Set<string>();
    splits.add(item.split);
    splitByFamily.set(item.family_id, splits);
    const sourceSplits = splitBySourceFamily.get(item.source_family) ?? new Set<string>();
    sourceSplits.add(item.split);
    splitBySourceFamily.set(item.source_family, sourceSplits);
  }
  if ([...splitByFamily.values()].some((splits) => splits.size > 1)) reasons.push("family_crosses_dev_holdout");
  if ([...splitBySourceFamily.values()].some((splits) => splits.size > 1)) reasons.push("source_family_crosses_dev_holdout");
  if (new Set(input.manifest.items.map((item) => item.sha256)).size !== input.manifest.items.length)
    reasons.push("exact_source_duplicate_detected");

  for (const record of input.reviews.records) {
    const agreed = reviewSignature(record.reviews[0]) === reviewSignature(record.reviews[1]);
    if (!agreed && !record.adjudication) reasons.push(`adjudication_required:${record.case_id}`);
    if (agreed && record.adjudication) reasons.push(`unnecessary_adjudication:${record.case_id}`);
  }
  const reviewMetrics = calculateReviewAgreement(input.reviews.records);
  if (input.reviews.records.length === 140 && reviewMetrics.agreement < 0.9)
    reasons.push("review_agreement_below_0_90");
  if (input.reviews.records.length === 140 && reviewMetrics.kappa < 0.75)
    reasons.push("review_kappa_below_0_75");

  let packages: { dev: QualityBenchmarkPackage; holdout: QualityBenchmarkPackage } | null = null;
  let readiness: ReturnType<typeof inspectQualityBenchmarkReadiness> | null = null;
  if (reasons.length === 0) {
    packages = {
      dev: compilePackage(input.manifest, input.reviews.records, "dev"),
      holdout: compilePackage(input.manifest, input.reviews.records, "holdout_private"),
    };
    readiness = inspectQualityBenchmarkReadiness(packages);
    if (!readiness.ready) reasons.push("benchmark_v2_1_readiness_failed");
  }
  return {
    ready: reasons.length === 0,
    reasons: [...new Set(reasons)],
    itemCount: input.manifest.items.length,
    rightsCount: input.rights.records.length,
    reviewCount: input.reviews.records.length,
    reviewMetrics,
    familyCount: splitByFamily.size,
    sourceFamilyCount: splitBySourceFamily.size,
    packages,
    readiness,
  };
}
