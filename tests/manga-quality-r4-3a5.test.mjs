import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import JSZip from "jszip";
import sharp from "sharp";
import { humanReviewPackageManifestSchema } from "../src/modules/manga-quality/domain/human-review-package.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const nodeArgs = ["--experimental-strip-types"];

function sourceCase(number) {
  return {
    source_case_id: `img_000${number}`,
    review_case_id: `case_00000${number}`,
    candidate_file: `assembly/images/img_000${number}.png`,
    required_provenance_chunks: [],
    review_mode: "intrinsic_only",
    intended_file: null,
    references: [],
    source_group_id: `srcgrp_000${number}`,
    source_family: `synthetic_mobile_${number}`,
    character_group_id: null,
    reference_group_id: null,
    target_split: "pilot_unassigned",
  };
}

async function buildMobilePackage(root, outputName = "reviewer-a-mobile.zip") {
  await mkdir(path.join(root, "assembly", "images"), { recursive: true });
  await sharp({ create: { width: 64, height: 96, channels: 3, background: "#7357a8" } }).png().toFile(path.join(root, "assembly", "images", "img_0001.png"));
  await sharp({ create: { width: 64, height: 96, channels: 3, background: "#39746f" } }).png().toFile(path.join(root, "assembly", "images", "img_0002.png"));
  const sourcePath = path.join(root, "assembly", "mobile-review.private.json");
  await writeFile(sourcePath, JSON.stringify({
    source_version: 1,
    benchmark_version: "2.1",
    package_id: "r4_3a5_mobile_test",
    review_scope: "PILOT_INTRINSIC_ONLY",
    formal_benchmark_eligible: false,
    cases: [sourceCase(1), sourceCase(2)],
  }));
  const output = path.join(root, "human-review-packages", outputName);
  await execFileAsync(process.execPath, [
    ...nodeArgs,
    path.join(repositoryRoot, "scripts", "build-manga-quality-review-package.mjs"),
    "--root", root,
    "--source", sourcePath,
    "--slot", "reviewer_a",
    "--output", output,
  ], { cwd: repositoryRoot });
  return output;
}

test("mobile offline review UI remains blind, local-only, and response-v2 compatible", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a5-mobile-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const output = await buildMobilePackage(root);
  const validated = await execFileAsync(process.execPath, [
    ...nodeArgs,
    path.join(repositoryRoot, "scripts", "validate-manga-quality-review-package.mjs"),
    "--package", output,
  ], { cwd: repositoryRoot });
  assert.match(validated.stdout, /REVIEW_PACKAGE_VALID/);

  const zip = await JSZip.loadAsync(await readFile(output));
  const manifest = JSON.parse(await zip.file("package-manifest.json").async("string"));
  assert.deepEqual(manifest.review_ui, {
    version: "mangai-mobile-offline-review-v1",
    entry_file: "review.html",
    network_access: false,
  });
  const html = await zip.file("review.html").async("string");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /mangai-human-review-v2/);
  assert.match(html, /回答JSONを保存/);
  assert.match(html, /localStorage/);
  assert.match(html, /new Blob/);
  assert.match(html, /FileReader/);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /source_group_id|source_family|expected_label|reviewer_a_result|good_prompt|bad_prompt/i);
  const executableScripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.doesNotThrow(() => new Function(executableScripts.at(-1)[1]));
  const embedded = html.match(/<script id="mangai-review-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(embedded);
  const mobileData = JSON.parse(embedded[1]);
  assert.deepEqual(mobileData.manifest, manifest);
  assert.deepEqual(mobileData.order, (await zip.file("review-order.txt").async("string")).trim().split(/\r?\n/));
  assert.equal(mobileData.template.reviewer_kind, "human");
  assert.equal(mobileData.template.independent, true);
  assert.deepEqual(mobileData.intended, {});
});

test("mobile review metadata is optional for old v2 packages and fails closed on network enablement", () => {
  const base = {
    package_version: "mangai-review-package-v2",
    benchmark_version: "2.1",
    package_id: "legacy_package",
    slot: "reviewer_a",
    package_status: "PILOT_PACKAGE_STRUCTURE_READY",
    review_scope: "PILOT_INTRINSIC_ONLY",
    formal_benchmark_eligible: false,
    case_count: 1,
    cases: [{
      case_id: "case_000001",
      review_mode: "intrinsic_only",
      candidate_file: "cases/case_000001/candidate.png",
      candidate_sha256: "a".repeat(64),
      intended_file: null,
      intended_sha256: null,
      references: [],
      allowed_defect_categories: ["anatomy_hand_error", "anatomy_body_distortion", "object_fusion", "unwanted_text", "unwanted_ui", "unwanted_logo", "crop_error", "orientation_error", "gravity_error", "low_readability", "other"],
    }],
  };
  assert.equal(humanReviewPackageManifestSchema.safeParse(base).success, true);
  assert.equal(humanReviewPackageManifestSchema.safeParse({
    ...base,
    review_ui: { version: "mangai-mobile-offline-review-v1", entry_file: "review.html", network_access: true },
  }).success, false);
});

test("package validator rejects a mobile UI whose embedded manifest was altered", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a5-tamper-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const output = await buildMobilePackage(root);
  const zip = await JSZip.loadAsync(await readFile(output));
  const html = await zip.file("review.html").async("string");
  const match = html.match(/<script id="mangai-review-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match);
  const data = JSON.parse(match[1]);
  data.manifest.package_id = "altered_mobile_package";
  zip.file("review.html", html.replace(match[1], JSON.stringify(data)));
  const tampered = path.join(root, "human-review-packages", "tampered.zip");
  await writeFile(tampered, await zip.generateAsync({ type: "nodebuffer" }));
  await assert.rejects(
    execFileAsync(process.execPath, [
      ...nodeArgs,
      path.join(repositoryRoot, "scripts", "validate-manga-quality-review-package.mjs"),
      "--package", tampered,
    ], { cwd: repositoryRoot }),
    /review_package_mobile_manifest_mismatch/,
  );
});
