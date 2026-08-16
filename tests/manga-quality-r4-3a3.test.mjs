import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  inspectQualityBenchmarkAssembly,
  qualityBenchmarkAssemblyManifestSchema,
  qualityBenchmarkReviewLedgerSchema,
  qualityBenchmarkRightsLedgerSchema,
} from "../src/modules/manga-quality/domain/quality-benchmark-assembly.ts";

const defectCategories = [
  "character_identity_mismatch",
  "anatomy_object_fusion",
  "unwanted_text_ui_logo",
  "composition_crop_error",
  "orientation_gravity_error",
  "background_prop_mismatch",
];

function verdictFor(index) {
  const local = index < 112 ? index : index - 112;
  const targets = index < 112 ? { good: 48, bad: 48 } : { good: 12, bad: 12 };
  if (local < targets.good) return "good";
  if (local < targets.good + targets.bad) return "bad";
  return "borderline";
}

function defectsFor(index, verdict) {
  if (verdict !== "bad") return [];
  const local = index < 112 ? index - 48 : index - 112 - 12;
  return [{ category: defectCategories[local % defectCategories.length], severity: "major" }];
}

function makeAssembly() {
  const items = Array.from({ length: 140 }, (_, index) => {
    const number = String(index + 1).padStart(4, "0");
    return {
      id: `img_${number}`,
      family_id: `family_${number}`,
      source_group_id: `srcgrp_${number}`,
      source_family: `synthetic_case_${number}`,
      character_group_id: null,
      reference_group_id: null,
      split: index < 112 ? "dev" : "holdout_private",
      source_file: `assembly/images/img_${number}.png`,
      sha256: String(index + 1).padStart(64, "0"),
      image_profile_id: "portrait_704x1024",
      judge_mode: "intrinsic",
      refs: [],
      intended: `assembly/intended/img_${number}.json`,
      rights_record_id: `rights_${number}`,
      derivation: "independent_original_case",
    };
  });
  const manifest = qualityBenchmarkAssemblyManifestSchema.parse({
    assembly_version: "1",
    benchmark_version: "2.1",
    dataset_id: "r4-3a-candidate",
    suite: "candidate",
    review_version: "human-v2.1",
    image_profiles: [{
      id: "portrait_704x1024",
      width: 704,
      height: 1024,
      source: "production_pipeline",
    }],
    items,
  });
  const rights = qualityBenchmarkRightsLedgerSchema.parse({
    assembly_version: "1",
    records: items.map((item, index) => ({
      id: item.rights_record_id,
      case_id: item.id,
      status: "verified",
      basis: "original_owned",
      benchmark_use_permitted: true,
      verified_by: "rights-reviewer",
      verified_at: "2026-08-16",
      evidence_file: `assembly/rights/rights_${String(index + 1).padStart(4, "0")}.json`,
      screening: {
        customer_content: false,
        production_content: false,
        monitor_content: false,
        adult_content: false,
        personal_information: false,
        v1_reuse: false,
        placeholder_image: false,
        trivial_transform_or_crop: false,
      },
    })),
  });
  const reviews = qualityBenchmarkReviewLedgerSchema.parse({
    assembly_version: "1",
    protocol: "human-dual-v1",
    records: items.map((item, index) => {
      const verdict = verdictFor(index);
      const defects = defectsFor(index, verdict);
      return {
        case_id: item.id,
        reviews: [
          { slot: "reviewer_a", reviewer_id: "reviewer-a", reviewer_kind: "human", independent: true, reviewed_at: "2026-08-16", verdict, defects },
          { slot: "reviewer_b", reviewer_id: "reviewer-b", reviewer_kind: "human", independent: true, reviewed_at: "2026-08-16", verdict, defects },
        ],
      };
    }),
  });
  return { manifest, rights, reviews };
}

test("assembly examples satisfy private collection and dual-review schemas", async () => {
  const root = new URL("./fixtures/manga-quality/examples/", import.meta.url);
  const readExample = async (name) => JSON.parse(await readFile(new URL(name, root), "utf8"));
  assert.equal(qualityBenchmarkAssemblyManifestSchema.safeParse(await readExample("assembly.private.example.json")).success, true);
  assert.equal(qualityBenchmarkRightsLedgerSchema.safeParse(await readExample("rights.private.example.json")).success, true);
  assert.equal(qualityBenchmarkReviewLedgerSchema.safeParse(await readExample("reviews.private.example.json")).success, true);
});

test("140 independently reviewed and family-isolated cases compile to v2.1 packages", () => {
  const inspection = inspectQualityBenchmarkAssembly(makeAssembly());
  assert.equal(inspection.ready, true);
  assert.equal(inspection.itemCount, 140);
  assert.equal(inspection.rightsCount, 140);
  assert.equal(inspection.reviewCount, 140);
  assert.equal(inspection.familyCount, 140);
  assert.equal(inspection.reviewMetrics.agreement, 1);
  assert.equal(inspection.reviewMetrics.kappa, 1);
  assert.equal(inspection.packages.dev.cases.length, 112);
  assert.equal(inspection.packages.holdout.privateLabels.length, 28);
  assert.equal("verdict" in inspection.packages.dev.cases[0], false);
});

test("one source family cannot cross dev and private holdout", () => {
  const input = makeAssembly();
  input.manifest.items[112].family_id = input.manifest.items[0].family_id;
  const inspection = inspectQualityBenchmarkAssembly(input);
  assert.equal(inspection.ready, false);
  assert.ok(inspection.reasons.includes("family_crosses_dev_holdout"));
});

test("one generation source family cannot cross dev and private holdout", () => {
  const input = makeAssembly();
  input.manifest.items[112].source_family = input.manifest.items[0].source_family;
  const inspection = inspectQualityBenchmarkAssembly(input);
  assert.equal(inspection.ready, false);
  assert.ok(inspection.reasons.includes("source_family_crosses_dev_holdout"));
});

test("review disagreement requires an independent adjudicator", () => {
  const input = makeAssembly();
  input.reviews.records[0].reviews[1].verdict = "borderline";
  const blocked = inspectQualityBenchmarkAssembly(input);
  assert.ok(blocked.reasons.includes("adjudication_required:img_0001"));
  input.reviews.records[0].adjudication = {
    adjudicator_id: "reviewer-c",
    adjudicator_kind: "human",
    decided_at: "2026-08-16",
    reason: "independent review disagreement",
    verdict: "good",
    defects: [],
  };
  assert.equal(inspectQualityBenchmarkAssembly(input).ready, true);
});

test("rights ledger rejects prohibited sources, v1 reuse, placeholders, and trivial variants", () => {
  const input = makeAssembly();
  const record = structuredClone(input.rights.records[0]);
  for (const field of ["customer_content", "production_content", "monitor_content", "adult_content", "personal_information", "v1_reuse", "placeholder_image", "trivial_transform_or_crop"]) {
    const invalid = { assembly_version: "1", records: [{ ...record, screening: { ...record.screening, [field]: true } }] };
    assert.equal(qualityBenchmarkRightsLedgerSchema.safeParse(invalid).success, false, field);
  }
});

test("AI reviews and non-neutral six-digit IDs do not enter the v2.1 contract", () => {
  const input = makeAssembly();
  const review = structuredClone(input.reviews.records[0]);
  review.reviews[0].reviewer_kind = "ai";
  assert.equal(qualityBenchmarkReviewLedgerSchema.safeParse({ assembly_version: "1", protocol: "human-dual-v1", records: [review] }).success, false);
  const invalidItem = { ...input.manifest.items[0], id: "img_000001", source_file: "assembly/images/img_000001.png", intended: "assembly/intended/img_000001.json" };
  assert.equal(qualityBenchmarkAssemblyManifestSchema.safeParse({ ...input.manifest, items: [invalidItem] }).success, false);
});

test("assembly provenance contract only permits an explicitly required C2PA caBX chunk", () => {
  const input = makeAssembly();
  input.manifest.items[0].required_provenance_chunks = ["caBX"];
  assert.equal(qualityBenchmarkAssemblyManifestSchema.safeParse(input.manifest).success, true);
  input.manifest.items[0].required_provenance_chunks = ["iTXt"];
  assert.equal(qualityBenchmarkAssemblyManifestSchema.safeParse(input.manifest).success, false);
});

test("assembly tools use a private root and do not call application providers", async () => {
  const assemblyScript = await readFile(new URL("../scripts/assemble-manga-quality-benchmark.mjs", import.meta.url), "utf8");
  const preflightScript = await readFile(new URL("../scripts/check-manga-quality-benchmark.mjs", import.meta.url), "utf8");
  assert.match(assemblyScript, /MANGAI_QUALITY_BENCHMARK_ROOT|QUALITY_BENCHMARK_ROOT_ENV/);
  assert.match(assemblyScript, /benchmark_output_exists_no_overwrite/);
  assert.match(assemblyScript, /benchmark_near_duplicate_detected/);
  assert.match(assemblyScript, /benchmark_required_provenance_missing/);
  assert.match(assemblyScript, /productionChanged: false/);
  assert.doesNotMatch(assemblyScript, /supabase|openai|black-forest|provider.*generate/i);
  assert.match(preflightScript, /MANGAI_QUALITY_BENCHMARK_ROOT/);
});
