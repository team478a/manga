import { z } from "zod";
import {
  HUMAN_REVIEW_TO_BENCHMARK_DEFECT_CATEGORY,
  humanReviewCaseIdSchema,
  humanReviewRecordSchema,
} from "./human-review-package.ts";
import {
  QUALITY_BENCHMARK_ASSEMBLY_VERSION,
  qualityBenchmarkReviewLedgerSchema,
} from "./quality-benchmark-assembly.ts";
import { qualityBenchmarkCaseIdSchema } from "./quality-benchmark-fixture.ts";

export const MONITOR_QUALITY_REVIEW_PRIVATE_ASSEMBLY_ADAPTER_VERSION =
  "mangai-monitor-review-private-assembly-adapter-v1" as const;

const dateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);
const uuidLike = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const compactUuidLike = /(?:^|[^0-9a-f])[0-9a-f]{32}(?:[^0-9a-f]|$)/i;

export const monitorQualityReviewPrivatePseudonymSchema = z.string()
  .regex(/^[a-z0-9][a-z0-9_-]{2,79}$/)
  .refine((value) => !uuidLike.test(value) && !compactUuidLike.test(value), {
    message: "pseudonym must not contain a Production UUID",
  })
  .refine((value) => !value.startsWith("monitor_")
    && !value.includes("profile")
    && !value.includes("assignment"), {
    message: "pseudonym must be an explicit neutral identifier",
  });

const privateReviewSchema = z.object({
  pseudonym_id: monitorQualityReviewPrivatePseudonymSchema,
  reviewed_at: dateSchema,
  payload: humanReviewRecordSchema,
}).strict();

const privateAdjudicationSchema = z.object({
  pseudonym_id: monitorQualityReviewPrivatePseudonymSchema,
  decided_at: dateSchema,
  reason: z.string().trim().min(1).max(500),
  payload: humanReviewRecordSchema,
}).strict();

const privateAssemblySourceRecordSchema = z.object({
  source_case_key: humanReviewCaseIdSchema,
  assembly_case_id: qualityBenchmarkCaseIdSchema,
  reviewer_a: privateReviewSchema,
  reviewer_b: privateReviewSchema,
  adjudication: privateAdjudicationSchema,
}).strict().superRefine((value, context) => {
  const identities = [
    value.reviewer_a.pseudonym_id,
    value.reviewer_b.pseudonym_id,
    value.adjudication.pseudonym_id,
  ];
  if (new Set(identities).size !== identities.length)
    context.addIssue({
      code: "custom",
      path: ["adjudication", "pseudonym_id"],
      message: "primary reviewers and adjudicator must be independent",
    });
  for (const [role, payload] of [
    ["reviewer_a", value.reviewer_a.payload],
    ["reviewer_b", value.reviewer_b.payload],
    ["adjudication", value.adjudication.payload],
  ] as const) {
    if (payload.case_id !== value.source_case_key)
      context.addIssue({
        code: "custom",
        path: [role, "payload", "case_id"],
        message: "payload case must match source case",
      });
  }
});

export const monitorQualityReviewPrivateAssemblySourceSchema = z.object({
  schema_version: z.literal(MONITOR_QUALITY_REVIEW_PRIVATE_ASSEMBLY_ADAPTER_VERSION),
  source_scope: z.literal("monitor_quality_review_pilot"),
  source_batch_code: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/),
  pilot_only: z.literal(true),
  formal_benchmark_eligible: z.literal(false),
  automatic_import: z.literal(false),
  records: z.array(privateAssemblySourceRecordSchema).min(1).max(28),
}).strict().superRefine((value, context) => {
  const sourceCases = value.records.map((record) => record.source_case_key);
  const assemblyCases = value.records.map((record) => record.assembly_case_id);
  if (new Set(sourceCases).size !== sourceCases.length)
    context.addIssue({ code: "custom", path: ["records"], message: "source case keys must be unique" });
  if (new Set(assemblyCases).size !== assemblyCases.length)
    context.addIssue({ code: "custom", path: ["records"], message: "assembly case IDs must be unique" });
});

export const monitorQualityReviewPrivateAssemblyOutputSchema = z.object({
  schema_version: z.literal(MONITOR_QUALITY_REVIEW_PRIVATE_ASSEMBLY_ADAPTER_VERSION),
  source_scope: z.literal("monitor_quality_review_pilot"),
  pilot_only: z.literal(true),
  formal_benchmark_eligible: z.literal(false),
  automatic_import: z.literal(false),
  assembly_version: z.literal(QUALITY_BENCHMARK_ASSEMBLY_VERSION),
  protocol: z.literal("human-dual-v1"),
  records: qualityBenchmarkReviewLedgerSchema.shape.records,
}).strict();

export type MonitorQualityReviewPrivateAssemblySource = z.infer<
  typeof monitorQualityReviewPrivateAssemblySourceSchema
>;
export type MonitorQualityReviewPrivateAssemblyOutput = z.infer<
  typeof monitorQualityReviewPrivateAssemblyOutputSchema
>;

function mapDefects(payload: z.infer<typeof humanReviewRecordSchema>) {
  return payload.defects.map((defect) => {
    const category = HUMAN_REVIEW_TO_BENCHMARK_DEFECT_CATEGORY[defect.category];
    if (!category)
      throw new Error(`monitor_adjudication_defect_not_formal_mappable:${defect.category}`);
    return {
      category,
      severity: defect.severity,
      ...(defect.bbox ? { bbox: defect.bbox } : {}),
    };
  });
}

/**
 * Converts an operator-authored, pseudonymized private source into assembly
 * ledger-compatible records. The wrapper remains explicitly pilot-only and is
 * never the canonical reviews.private.json ledger by itself.
 */
export function adaptMonitorQualityReviewToPrivateAssembly(
  value: unknown,
): MonitorQualityReviewPrivateAssemblyOutput {
  const source = monitorQualityReviewPrivateAssemblySourceSchema.parse(value);
  const records = source.records.map((record) => ({
    case_id: record.assembly_case_id,
    reviews: (["reviewer_a", "reviewer_b"] as const).map((slot) => {
      const review = record[slot];
      return {
        slot,
        reviewer_id: review.pseudonym_id,
        reviewer_kind: "human" as const,
        independent: true as const,
        reviewed_at: review.reviewed_at,
        verdict: review.payload.verdict,
        defects: mapDefects(review.payload),
      };
    }),
    adjudication: {
      adjudicator_id: record.adjudication.pseudonym_id,
      adjudicator_kind: "human" as const,
      decided_at: record.adjudication.decided_at,
      reason: record.adjudication.reason,
      verdict: record.adjudication.payload.verdict,
      defects: mapDefects(record.adjudication.payload),
    },
  }));

  qualityBenchmarkReviewLedgerSchema.parse({
    assembly_version: QUALITY_BENCHMARK_ASSEMBLY_VERSION,
    protocol: "human-dual-v1",
    records,
  });
  return monitorQualityReviewPrivateAssemblyOutputSchema.parse({
    schema_version: MONITOR_QUALITY_REVIEW_PRIVATE_ASSEMBLY_ADAPTER_VERSION,
    source_scope: "monitor_quality_review_pilot",
    pilot_only: true,
    formal_benchmark_eligible: false,
    automatic_import: false,
    assembly_version: QUALITY_BENCHMARK_ASSEMBLY_VERSION,
    protocol: "human-dual-v1",
    records,
  });
}
