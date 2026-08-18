import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import JSZip from "jszip";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const validator = path.join(repositoryRoot, "scripts", "validate-manga-quality-rights-review-package.mjs");
const importer = path.join(repositoryRoot, "scripts", "import-manga-quality-monitor-review-batch.mjs");

async function buildRightsPackage(root, responseOverride = {}) {
  const image = await sharp({ create: { width: 704, height: 1024, channels: 3, background: "#d8d5ce" } }).png().toBuffer();
  const imageSha = createHash("sha256").update(image).digest("hex");
  const manifest = {
    package_version: "mangai-rights-review-v1",
    batch_id: "private-batch-01",
    purpose: "PRIVATE_BENCHMARK_RIGHTS_REVIEW",
    case_count: 1,
    cases: [{ image_id: "img_0001", file: "images/img_0001.png", sha256: imageSha, required_provenance_chunks: [] }],
  };
  const response = {
    template_version: "mangai-rights-review-response-v1",
    batch_id: manifest.batch_id,
    verified_by: "Rights Reviewer",
    verified_at: "2020-01-01T10:00:00+09:00",
    terms_reviewed: true,
    records: [{
      image_id: "img_0001",
      decision: "approved",
      provider_terms_confirmed: true,
      benchmark_use_approved: true,
      no_customer_or_production_content: true,
      no_personal_information: true,
      no_adult_content: true,
      notes: "",
    }],
    ...responseOverride,
  };
  const zip = new JSZip();
  zip.file("README_JA.md", "private rights review");
  zip.file("provider-terms-evidence.private.md", "Human reviewer checks provider terms separately.");
  zip.file("package-manifest.json", JSON.stringify(manifest));
  zip.file("rights-response.private.json", JSON.stringify(response));
  zip.file("images/img_0001.png", image);
  const packagePath = path.join(root, "rights-review.zip");
  await writeFile(packagePath, await zip.generateAsync({ type: "nodebuffer" }));
  return packagePath;
}

test("権利確認packageの構造検査と完了検査を分離する", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a8-structural-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packagePath = await buildRightsPackage(root, {
    verified_by: "",
    verified_at: "",
    terms_reviewed: false,
    records: [{ image_id: "img_0001" }],
  });
  const structural = await execFileAsync(process.execPath, [validator, "--package", packagePath, "--expected-count", "1"]);
  assert.match(structural.stdout, /RIGHTS_REVIEW_PACKAGE_VALID/);
  await assert.rejects(
    execFileAsync(process.execPath, [validator, "--package", packagePath, "--expected-count", "1", "--require-complete"]),
    /rights_review_verified_by_required/,
  );
});

test("全件承認と必須attestationがある場合だけ権利確認完了にする", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a8-complete-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packagePath = await buildRightsPackage(root);
  const result = await execFileAsync(process.execPath, [validator, "--package", packagePath, "--expected-count", "1", "--require-complete"]);
  assert.match(result.stdout, /RIGHTS_REVIEW_COMPLETE/);
  assert.match(result.stdout, /"completionChecked": true/);

  const rejectedPath = await buildRightsPackage(root, {
    records: [{
      image_id: "img_0001", decision: "rejected", provider_terms_confirmed: true,
      benchmark_use_approved: true, no_customer_or_production_content: true,
      no_personal_information: true, no_adult_content: true,
    }],
  });
  await assert.rejects(
    execFileAsync(process.execPath, [validator, "--package", rejectedPath, "--expected-count", "1", "--require-complete"]),
    /rights_review_case_not_approved:img_0001/,
  );
});

test("monitor batch取込は既定dry-runでDBとStorageを変更しない", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a8-admit-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packagePath = await buildRightsPackage(root);
  const admissionArguments = [
    importer,
    "--package", packagePath,
    "--batch-code", "batch_private_01",
    "--created-by-profile-id", "11111111-1111-4111-8111-111111111111",
    "--starts-at", "2026-08-18T00:00:00Z",
    "--expires-at", "2099-09-18T00:00:00Z",
    "--expected-count", "1",
  ];
  const result = await execFileAsync(process.execPath, admissionArguments);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "STAGING_BATCH_ADMISSION_READY");
  assert.equal(output.mode, "dry_run");
  assert.equal(output.cases, 1);
  assert.equal(output.rightsCompletionChecked, true);
  assert.equal(output.databaseChanged, false);
  assert.equal(output.storageChanged, false);
  assert.equal(output.productionChanged, false);
  await assert.rejects(
    execFileAsync(process.execPath, [...admissionArguments, "--apply"], {
      env: {
        ...process.env,
        MANGAI_MONITOR_REVIEW_STAGING_SUPABASE_URL: "",
        MANGAI_MONITOR_REVIEW_STAGING_SERVICE_ROLE_KEY: "",
        MANGAI_MONITOR_REVIEW_STAGING_PROJECT_REF: "",
        MANGAI_MONITOR_REVIEW_PRODUCTION_PROJECT_REF: "",
      },
    }),
    /monitor_review_staging_service_role_required/,
  );
});

test("取込CLIはstaging専用環境変数、draft登録、非上書きupload、失敗cleanupを強制する", async () => {
  const source = await readFile(importer, "utf8");
  assert.match(source, /MANGAI_MONITOR_REVIEW_STAGING_SUPABASE_URL/);
  assert.match(source, /MANGAI_MONITOR_REVIEW_STAGING_SERVICE_ROLE_KEY/);
  assert.match(source, /MANGAI_MONITOR_REVIEW_STAGING_PROJECT_REF/);
  assert.match(source, /MANGAI_MONITOR_REVIEW_PRODUCTION_PROJECT_REF/);
  assert.match(source, /status: "draft"/);
  assert.match(source, /upsert: false/);
  assert.match(source, /storage\.from\(REVIEW_BUCKET\)\.remove\(uploadedPaths\)/);
  assert.match(source, /cloud_monitor_quality_review_batches"\)\.delete\(\)\.eq\("id", batchId\)/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY(?!")/);
  assert.doesNotMatch(source, /getPublicUrl|createSignedUrl/);
});
