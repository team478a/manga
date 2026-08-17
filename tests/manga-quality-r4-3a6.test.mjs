import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import JSZip from "jszip";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const nodeArgs = ["--experimental-strip-types"];

async function buildReviewPackage(root) {
  await mkdir(path.join(root, "assembly", "images"), { recursive: true });
  await sharp({ create: { width: 64, height: 96, channels: 3, background: "#51478f" } }).png().toFile(path.join(root, "assembly", "images", "img_0001.png"));
  const sourcePath = path.join(root, "assembly", "review.private.json");
  await writeFile(sourcePath, JSON.stringify({
    source_version: 1,
    benchmark_version: "2.1",
    package_id: "secure_transfer_private_test",
    review_scope: "PILOT_INTRINSIC_ONLY",
    formal_benchmark_eligible: false,
    cases: [{
      source_case_id: "img_0001", review_case_id: "case_000001", candidate_file: "assembly/images/img_0001.png",
      required_provenance_chunks: [], review_mode: "intrinsic_only", intended_file: null, references: [],
      source_group_id: "srcgrp_0001", source_family: "secure_transfer_family", character_group_id: null,
      reference_group_id: null, target_split: "pilot_unassigned",
    }],
  }));
  const packagePath = path.join(root, "human-review-packages", "private-reviewer-a.zip");
  await execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "build-manga-quality-review-package.mjs"), "--root", root, "--source", sourcePath, "--slot", "reviewer_a", "--output", packagePath], { cwd: repositoryRoot });
  return packagePath;
}

test("secure transfer encrypts a valid review ZIP without leaking its private identity", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a6-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packagePath = await buildReviewPackage(root);
  const passphrasePath = path.join(root, "secrets", "passphrase.txt");
  await execFileAsync(process.execPath, [path.join(repositoryRoot, "scripts", "generate-manga-quality-review-transfer-passphrase.mjs"), "--output", passphrasePath], { cwd: repositoryRoot });
  const envelopePath = path.join(root, "out", "transfer-001.html");
  const built = await execFileAsync(process.execPath, [path.join(repositoryRoot, "scripts", "build-manga-quality-secure-review-transfer.mjs"), "--package", packagePath, "--passphrase-file", passphrasePath, "--output", envelopePath, "--recipient-role", "reviewer_a", "--private-mapping", path.join(root, "secrets", "mapping.json")], { cwd: repositoryRoot });
  assert.match(built.stdout, /REVIEW_TRANSFER_CREATED/);
  assert.doesNotMatch(built.stdout, /secure_transfer_private_test|reviewer_a/);
  const validated = await execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "validate-manga-quality-secure-review-transfer.mjs"), "--envelope", envelopePath, "--passphrase-file", passphrasePath], { cwd: repositoryRoot });
  assert.match(validated.stdout, /REVIEW_TRANSFER_VALID/);
  const html = await readFile(envelopePath, "utf8");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /AES-GCM/);
  assert.match(html, /PBKDF2/);
  assert.match(html, /crypto\.subtle/);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /secure_transfer_private_test|reviewer_a|private-reviewer-a/i);
  assert.doesNotMatch(html, new RegExp((await readFile(passphrasePath, "utf8")).trim()));
});

test("secure transfer fails closed for a wrong passphrase and refuses overwrite", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a6-fail-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packagePath = await buildReviewPackage(root);
  const passphrasePath = path.join(root, "passphrase.txt");
  const wrongPath = path.join(root, "wrong.txt");
  await writeFile(passphrasePath, "correct-passphrase-for-private-review\n");
  await writeFile(wrongPath, "incorrect-passphrase-for-reviewing\n");
  const envelopePath = path.join(root, "transfer.html");
  const buildArgs = [path.join(repositoryRoot, "scripts", "build-manga-quality-secure-review-transfer.mjs"), "--package", packagePath, "--passphrase-file", passphrasePath, "--output", envelopePath, "--recipient-role", "reviewer_a", "--private-mapping", path.join(root, "mapping.json")];
  await execFileAsync(process.execPath, buildArgs, { cwd: repositoryRoot });
  await assert.rejects(execFileAsync(process.execPath, buildArgs, { cwd: repositoryRoot }), /review_transfer_output_exists_no_overwrite/);
  await assert.rejects(execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "validate-manga-quality-secure-review-transfer.mjs"), "--envelope", envelopePath, "--passphrase-file", wrongPath], { cwd: repositoryRoot }), /review_transfer_decryption_failed/);
});

test("secure transfer accepts a validated rights-review package without exposing its batch", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a6-rights-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const image = await sharp({ create: { width: 64, height: 96, channels: 3, background: "#36455c" } }).png().toBuffer();
  const imageSha = createHash("sha256").update(image).digest("hex");
  const manifest = {
    package_version: "mangai-rights-review-v1", batch_id: "private-rights-batch", purpose: "PRIVATE_BENCHMARK_RIGHTS_REVIEW", case_count: 1,
    cases: [{ image_id: "img_0001", file: "images/img_0001.png", sha256: imageSha, required_provenance_chunks: [] }],
  };
  const response = { template_version: "mangai-rights-review-response-v1", batch_id: manifest.batch_id, verified_by: "", verified_at: "", terms_reviewed: false, records: [{ image_id: "img_0001" }] };
  const zip = new JSZip();
  zip.file("README_JA.md", "private rights review");
  zip.file("provider-terms-evidence.private.md", "terms reviewed separately");
  zip.file("package-manifest.json", JSON.stringify(manifest));
  zip.file("rights-response.private.json", JSON.stringify(response));
  zip.file("images/img_0001.png", image);
  const packagePath = path.join(root, "private-rights.zip");
  await writeFile(packagePath, await zip.generateAsync({ type: "nodebuffer" }));
  const passphrasePath = path.join(root, "passphrase.txt");
  await writeFile(passphrasePath, "rights-review-passphrase-is-separate\n");
  const envelopePath = path.join(root, "neutral-transfer.html");
  await execFileAsync(process.execPath, [path.join(repositoryRoot, "scripts", "build-manga-quality-secure-review-transfer.mjs"), "--package", packagePath, "--package-kind", "rights-review", "--passphrase-file", passphrasePath, "--output", envelopePath, "--recipient-role", "rights_reviewer", "--private-mapping", path.join(root, "mapping.json")], { cwd: repositoryRoot });
  const validated = await execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "validate-manga-quality-secure-review-transfer.mjs"), "--envelope", envelopePath, "--passphrase-file", passphrasePath], { cwd: repositoryRoot });
  assert.match(validated.stdout, /mangai-rights-review-v1/);
  assert.doesNotMatch(await readFile(envelopePath, "utf8"), /private-rights-batch|private-rights\.zip/);
});
