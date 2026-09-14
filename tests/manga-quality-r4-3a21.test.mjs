import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  buildMonitorQualityReviewAdjudicationSummary,
  monitorQualityReviewAdjudicationSummarySchema,
} from "../src/modules/manga-quality/domain/monitor-quality-review-adjudication.ts";
import {
  adaptMonitorQualityReviewToPrivateAssembly,
  monitorQualityReviewPrivateAssemblySourceSchema,
} from "../src/modules/manga-quality/domain/monitor-quality-review-private-assembly.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");

function payload(caseId, verdict = "good", category = "anatomy_hand_error") {
  return {
    case_id: caseId,
    verdict,
    confidence: 5,
    defects: verdict === "bad"
      ? [{ category, severity: "major", bbox: [0.1, 0.2, 0.3, 0.4], comment: "private free text" }]
      : [],
    overall_comment: "private overall comment",
  };
}

function privateSource(overrides = {}) {
  const source = {
    schema_version: "mangai-monitor-review-private-assembly-adapter-v1",
    source_scope: "monitor_quality_review_pilot",
    source_batch_code: "batch_private_01",
    pilot_only: true,
    formal_benchmark_eligible: false,
    automatic_import: false,
    records: [{
      source_case_key: "case_000003",
      assembly_case_id: "img_0003",
      reviewer_a: {
        pseudonym_id: "reviewer-a",
        reviewed_at: "2026-09-14T01:00:00Z",
        payload: payload("case_000003", "good"),
      },
      reviewer_b: {
        pseudonym_id: "reviewer-b",
        reviewed_at: "2026-09-14T01:01:00Z",
        payload: payload("case_000003", "bad"),
      },
      adjudication: {
        pseudonym_id: "adjudicator-c",
        decided_at: "2026-09-14T02:00:00Z",
        reason: "定義に照らして重大な手指破綻を確認した。",
        payload: payload("case_000003", "bad"),
      },
    }],
  };
  return { ...source, ...overrides };
}

test("匿名裁定summaryは許可項目だけを出力し、元指標と正式資格を変更しない", () => {
  const summary = buildMonitorQualityReviewAdjudicationSummary({
    batchCode: "batch_private_01",
    disagreementCaseKeys: ["case_000003", "case_000004"],
    adjudications: [
      {
        caseKey: "case_000003",
        status: "submitted",
        independentPayload: payload("case_000003", "good"),
        finalPayload: payload("case_000003", "bad"),
      },
      {
        caseKey: "case_000004",
        status: "abstained",
        independentPayload: null,
        finalPayload: null,
      },
    ],
  });
  assert.equal(monitorQualityReviewAdjudicationSummarySchema.safeParse(summary).success, true);
  assert.deepEqual(summary.counts, { required: 2, completed: 1, pending: 1, abstained: 1 });
  assert.equal(summary.derived_decision.status, "adjudication_blocked");
  assert.equal(summary.original_agreement_metrics_changed, false);
  assert.equal(summary.formal_benchmark_eligible, false);
  assert.equal(summary.automatic_adoption, false);
  assert.deepEqual(summary.records[0].final_defects, [
    { category: "anatomy_hand_error", severity: "major" },
  ]);
  const serialized = JSON.stringify(summary);
  for (const forbidden of [
    "reviewer", "adjudicator", "profile", "assignment", "private free text",
    "private overall comment", "confidence", "submitted_at", "reviewed_at", "bbox",
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);
});

test("匿名裁定summaryは欠損・case不一致・未知フィールドをfail closedで拒否する", () => {
  assert.throws(() => buildMonitorQualityReviewAdjudicationSummary({
    batchCode: "batch_private_01",
    disagreementCaseKeys: ["case_000003"],
    adjudications: [{
      caseKey: "case_000003",
      status: "submitted",
      independentPayload: payload("case_000003"),
      finalPayload: null,
    }],
  }), /final_payload_missing/);
  assert.throws(() => buildMonitorQualityReviewAdjudicationSummary({
    batchCode: "batch_private_01",
    disagreementCaseKeys: ["case_000003"],
    adjudications: [{
      caseKey: "case_000003",
      status: "submitted",
      independentPayload: payload("case_000003"),
      finalPayload: payload("case_000004", "bad"),
    }],
  }), /final_case_mismatch/);
  assert.equal(monitorQualityReviewAdjudicationSummarySchema.safeParse({
    schema_version: "mangai-monitor-review-adjudication-summary-v1",
    batch_code: "batch_private_01",
    anonymized: true,
    automatic_adoption: false,
    original_agreement_metrics_changed: false,
    formal_benchmark_eligible: false,
    counts: { required: 0, completed: 0, pending: 0, abstained: 0 },
    derived_decision: {
      status: "not_required", blockers: [], required_case_keys: [],
      submitted_case_keys: [], pending_case_keys: [],
    },
    records: [],
    email: "forbidden@example.com",
  }).success, false);
});

test("private adapterは明示的な仮名とcase対応だけを正式ledger互換recordへ変換する", () => {
  const output = adaptMonitorQualityReviewToPrivateAssembly(privateSource());
  assert.equal(output.pilot_only, true);
  assert.equal(output.formal_benchmark_eligible, false);
  assert.equal(output.automatic_import, false);
  assert.equal(output.records[0].case_id, "img_0003");
  assert.deepEqual(output.records[0].reviews[1].defects, [{
    category: "anatomy_object_fusion",
    severity: "major",
    bbox: [0.1, 0.2, 0.3, 0.4],
  }]);
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes("case_000003"), false);
  assert.equal(serialized.includes("private free text"), false);
  assert.equal(serialized.includes("private overall comment"), false);
});

test("repository内の例示入力もprivate adapter契約を満たす", async () => {
  const example = JSON.parse(await readFile(new URL(
    "../tests/fixtures/manga-quality/examples/monitor-adjudication-private-assembly.example.json",
    import.meta.url,
  ), "utf8"));
  const output = adaptMonitorQualityReviewToPrivateAssembly(example);
  assert.equal(output.records.length, 1);
  assert.equal(output.formal_benchmark_eligible, false);
});

test("private adapterはProduction由来ID、非独立担当、変換不能defectを拒否する", () => {
  const uuid = "a115917-caef-4e4c-ad0c-f8f27b62e900";
  const withProductionId = privateSource();
  withProductionId.records[0].adjudication.pseudonym_id = `monitor_${uuid.replaceAll("-", "")}`;
  assert.equal(monitorQualityReviewPrivateAssemblySourceSchema.safeParse(withProductionId).success, false);

  const sameReviewer = privateSource();
  sameReviewer.records[0].adjudication.pseudonym_id = "reviewer-a";
  assert.throws(() => adaptMonitorQualityReviewToPrivateAssembly(sameReviewer), /must be independent/);

  const unmappable = privateSource();
  unmappable.records[0].adjudication.payload = payload("case_000003", "bad", "style_inconsistency");
  assert.throws(() => adaptMonitorQualityReviewToPrivateAssembly(unmappable), /defect_not_formal_mappable/);
});

test("管理者routeはprivate no-storeで、repositoryの専用取得はPII列を選択しない", async () => {
  const [repository, route, page] = await Promise.all([
    readFile(new URL("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/general-monitors/quality-review/adjudication-export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/general-monitors/quality-review/page.tsx", import.meta.url), "utf8"),
  ]);
  const loader = repository.slice(repository.indexOf("export async function loadMonitorQualityReviewAdjudicationSummary"));
  assert.match(loader, /case_id,status,independent_payload,final_payload/);
  assert.doesNotMatch(loader, /adjudicator_profile_id|reviewer_profile_id|decision_reason|submitted_at|display_name|email/);
  assert.match(route, /await requireAdmin\(\)/);
  assert.match(route, /cache-control": "private, no-store/);
  assert.match(route, /x-content-type-options": "nosniff/);
  assert.match(page, /匿名裁定JSONを保存/);
});

test("private CLIはGit外rootだけへno-overwriteで書き、canonical ledgerを直接作らない", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mangai-adjudication-adapter-"));
  try {
    await writeFile(path.join(root, "source.private.json"), JSON.stringify(privateSource()), "utf8");
    const script = path.join(repositoryRoot, "scripts", "adapt-monitor-quality-adjudication-private-assembly.mjs");
    const args = [
      "--experimental-strip-types", script,
      "--root", root,
      "--source", "source.private.json",
      "--output", "staging/adjudication-records.private.json",
    ];
    const first = await execFileAsync(process.execPath, args, { cwd: repositoryRoot });
    assert.match(first.stdout, /PRIVATE_ADAPTER_OUTPUT_WRITTEN/);
    const output = JSON.parse(await readFile(path.join(root, "staging", "adjudication-records.private.json"), "utf8"));
    assert.equal(output.formal_benchmark_eligible, false);
    await assert.rejects(execFileAsync(process.execPath, args, { cwd: repositoryRoot }), /output_exists_no_overwrite/);
    await assert.rejects(execFileAsync(process.execPath, [
      "--experimental-strip-types", script,
      "--root", root,
      "--source", "source.private.json",
      "--output", "assembly/reviews.private.json",
    ], { cwd: repositoryRoot }), /cannot_write_canonical_ledger/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
