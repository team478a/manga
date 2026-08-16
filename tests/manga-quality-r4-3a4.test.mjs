import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import sharp from "sharp";
import test from "node:test";
import {
  HUMAN_REVIEW_DEFECT_CATEGORIES,
  INTRINSIC_REVIEW_DEFECT_CATEGORIES,
  allowedDefectCategoriesForCase,
  compareHumanReviewResponses,
  humanReviewAiAuditSchema,
  humanReviewPackageCaseSchema,
  humanReviewPackageSourceSchema,
  humanReviewResponseSchema,
  validateHumanReviewResponseForPackage,
} from "../src/modules/manga-quality/domain/human-review-package.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const nodeArgs = ["--experimental-strip-types"];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function insertPngChunk(bytes, type, data = Buffer.from("mangai-provenance-test")) {
  let offset = 8;
  let iendOffset = -1;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const chunkType = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (chunkType === "IEND") {
      iendOffset = offset;
      break;
    }
    offset += 12 + length;
  }
  if (iendOffset < 0) throw new Error("IEND missing");
  const typeBytes = Buffer.from(type, "ascii");
  const lengthBytes = Buffer.alloc(4);
  lengthBytes.writeUInt32BE(data.length);
  const crcBytes = Buffer.alloc(4);
  crcBytes.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  const chunk = Buffer.concat([lengthBytes, typeBytes, data, crcBytes]);
  return Buffer.concat([bytes.subarray(0, iendOffset), chunk, bytes.subarray(iendOffset)]);
}

function packageManifest(slot = "reviewer_b") {
  return {
    package_version: "mangai-review-package-v2",
    benchmark_version: "2.1",
    package_id: "r4_3a4_test",
    slot,
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
      allowed_defect_categories: [...INTRINSIC_REVIEW_DEFECT_CATEGORIES],
    }],
  };
}

function completedResponse(slot = "reviewer_b", reviewerId = "human-reviewer-b", verdict = "bad") {
  return {
    template_version: "mangai-human-review-v2",
    slot,
    reviewer_id: reviewerId,
    reviewer_kind: "human",
    independent: true,
    reviewed_at: "2026-08-17T09:00:00+09:00",
    records: [{
      case_id: "case_000001",
      verdict,
      confidence: 4,
      defects: verdict === "bad" ? [{ category: "anatomy_hand_error", severity: "major", bbox: [0.2, 0.2, 0.2, 0.2], comment: "hand" }] : [],
      overall_comment: verdict === "borderline" ? "borderline evidence" : "",
    }],
  };
}

test("review modes keep intrinsic and referential categories separate", () => {
  const intrinsic = allowedDefectCategoriesForCase({ reviewMode: "intrinsic_only" });
  assert.deepEqual(intrinsic, [...INTRINSIC_REVIEW_DEFECT_CATEGORIES]);
  assert.equal(intrinsic.includes("character_identity_mismatch"), false);
  assert.equal(intrinsic.includes("background_mismatch"), false);
  const noIdentityReference = allowedDefectCategoriesForCase({ reviewMode: "referential", referenceRoles: ["location"] });
  assert.equal(noIdentityReference.includes("character_identity_mismatch"), false);
  assert.equal(noIdentityReference.includes("composition_mismatch"), true);
  assert.equal(HUMAN_REVIEW_DEFECT_CATEGORIES.includes("style_inconsistency"), true);
});

test("referential identity review requires intended context and a bound identity reference", () => {
  const item = packageManifest().cases[0];
  assert.equal(humanReviewPackageCaseSchema.safeParse({
    ...item,
    review_mode: "referential",
    allowed_defect_categories: allowedDefectCategoriesForCase({ reviewMode: "referential", referenceRoles: ["character_identity"] }),
  }).success, false);
  assert.equal(humanReviewPackageCaseSchema.safeParse({
    ...item,
    review_mode: "referential",
    intended_file: "cases/case_000001/intended.json",
    intended_sha256: "b".repeat(64),
    references: [{
      reference_id: "ref_01",
      role: "character_identity",
      binding_id: "92b651c0-3db4-5ca8-8ee3-8ccfc242ef38",
      file: "cases/case_000001/references/ref_01.png",
      sha256: "c".repeat(64),
    }],
    allowed_defect_categories: allowedDefectCategoriesForCase({ reviewMode: "referential", referenceRoles: ["character_identity"] }),
  }).success, true);
});

test("response schema fixes human reviewer, confidence, bbox, and verdict consistency", () => {
  assert.equal(humanReviewResponseSchema.safeParse(completedResponse()).success, true);
  assert.equal(humanReviewResponseSchema.safeParse({ ...completedResponse(), reviewer_kind: "ai_audit" }).success, false);
  const badConfidence = completedResponse();
  badConfidence.records[0].confidence = 6;
  assert.equal(humanReviewResponseSchema.safeParse(badConfidence).success, false);
  const badBbox = completedResponse();
  badBbox.records[0].defects[0].bbox = [0.9, 0.2, 0.2, 0.2];
  assert.equal(humanReviewResponseSchema.safeParse(badBbox).success, false);
  const goodWithDefect = completedResponse("reviewer_b", "human-reviewer-b", "good");
  goodWithDefect.records[0].defects = [{ category: "object_fusion", severity: "major", bbox: null, comment: "fusion" }];
  assert.equal(humanReviewResponseSchema.safeParse(goodWithDefect).success, false);
});

test("package-aware validation rejects missing, unknown, and mode-forbidden categories", () => {
  const response = completedResponse();
  assert.equal(validateHumanReviewResponseForPackage(response, packageManifest()).valid, true);
  const forbidden = structuredClone(response);
  forbidden.records[0].defects[0].category = "composition_mismatch";
  const invalid = validateHumanReviewResponseForPackage(forbidden, packageManifest());
  assert.equal(invalid.valid, false);
  assert.ok(invalid.reasons.includes("category_not_allowed:case_000001:composition_mismatch"));
});

test("AI audit cannot satisfy dual human review and disagreements require adjudication", () => {
  assert.equal(humanReviewAiAuditSchema.safeParse({
    template_version: "mangai-ai-audit-v1",
    auditor_id: "quality-audit-bot",
    reviewer_kind: "ai_audit",
    reviewed_at: "2026-08-17T09:00:00+09:00",
    records: completedResponse().records,
  }).success, true);
  const a = completedResponse("reviewer_a", "human-reviewer-a", "bad");
  const b = completedResponse("reviewer_b", "human-reviewer-b", "bad");
  const agreed = compareHumanReviewResponses(a, b, packageManifest());
  assert.equal(agreed.valid, true);
  assert.equal(agreed.disagreement_count, 0);
  b.records[0].verdict = "borderline";
  b.records[0].overall_comment = "human disagreement";
  const disagreed = compareHumanReviewResponses(a, b, packageManifest());
  assert.equal(disagreed.adjudication_required_count, 1);
});

test("source metadata keeps one source family out of both dev and holdout", () => {
  const baseCase = {
    source_case_id: "img_0001",
    review_case_id: "case_000001",
    candidate_file: "assembly/images/img_0001.png",
    review_mode: "intrinsic_only",
    intended_file: null,
    references: [],
    source_group_id: "srcgrp_0001",
    source_family: "synthetic_batch_x",
    character_group_id: null,
    reference_group_id: null,
    target_split: "dev",
  };
  const invalid = {
    source_version: 1,
    benchmark_version: "2.1",
    package_id: "formal_test",
    review_scope: "FORMAL_CANDIDATE",
    formal_benchmark_eligible: true,
    cases: [baseCase, { ...baseCase, source_case_id: "img_0002", review_case_id: "case_000002", candidate_file: "assembly/images/img_0002.png", target_split: "holdout_private" }],
  };
  assert.equal(humanReviewPackageSourceSchema.safeParse(invalid).success, false);
});

test("required Content Credentials survive blind package generation and validation", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a4-provenance-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const imageDir = path.join(root, "assembly", "images");
  await mkdir(imageDir, { recursive: true });
  const plain = await sharp({ create: { width: 32, height: 48, channels: 3, background: "#557799" } }).png().toBuffer();
  const withCredentials = insertPngChunk(plain, "caBX");
  const imagePath = path.join(imageDir, "img_0001.png");
  await writeFile(imagePath, withCredentials);
  const source = {
    source_version: 1,
    benchmark_version: "2.1",
    package_id: "r4_3a4_provenance_test",
    review_scope: "FORMAL_CANDIDATE",
    formal_benchmark_eligible: true,
    cases: [{
      source_case_id: "img_0001",
      review_case_id: "case_000001",
      candidate_file: "assembly/images/img_0001.png",
      required_provenance_chunks: ["caBX"],
      review_mode: "intrinsic_only",
      intended_file: null,
      references: [],
      source_group_id: "srcgrp_0001",
      source_family: "synthetic_batch_provenance",
      character_group_id: null,
      reference_group_id: null,
      target_split: "dev",
    }],
  };
  const sourcePath = path.join(root, "assembly", "review-package.private.json");
  await writeFile(sourcePath, JSON.stringify(source));
  const output = path.join(root, "human-review-packages", "reviewer-b.zip");
  await execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "build-manga-quality-review-package.mjs"), "--root", root, "--source", sourcePath, "--slot", "reviewer_b", "--output", output], { cwd: repositoryRoot });
  const validated = await execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "validate-manga-quality-review-package.mjs"), "--package", output], { cwd: repositoryRoot });
  assert.match(validated.stdout, /REVIEW_PACKAGE_VALID/);
  const zip = await JSZip.loadAsync(await readFile(output));
  const packaged = await zip.file("cases/case_000001/candidate.png").async("nodebuffer");
  assert.equal(packaged.includes(Buffer.from("caBX")), true);
  const sidecar = JSON.parse(await readFile(output.replace(/\.zip$/, ".source-metadata.private.json"), "utf8"));
  assert.deepEqual(sidecar.cases[0].required_provenance_chunks, ["caBX"]);

  await writeFile(imagePath, plain);
  await assert.rejects(
    execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "build-manga-quality-review-package.mjs"), "--root", root, "--source", sourcePath, "--slot", "reviewer_a", "--output", path.join(root, "human-review-packages", "missing.zip")], { cwd: repositoryRoot }),
    /required_provenance_missing/,
  );
});

test("generator creates blind A/B packages and both package validators pass", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a4-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const imageDir = path.join(root, "assembly", "images");
  await mkdir(imageDir, { recursive: true });
  await sharp({ create: { width: 32, height: 48, channels: 3, background: "#663399" } }).png().toFile(path.join(imageDir, "img_0001.png"));
  await sharp({ create: { width: 32, height: 48, channels: 3, background: "#338866" } }).png().toFile(path.join(imageDir, "img_0002.png"));
  const source = {
    source_version: 1,
    benchmark_version: "2.1",
    package_id: "r4_3a4_pilot_test",
    review_scope: "PILOT_INTRINSIC_ONLY",
    formal_benchmark_eligible: false,
    cases: [1, 2].map((number) => ({
      source_case_id: `img_000${number}`,
      review_case_id: `case_00000${number}`,
      candidate_file: `assembly/images/img_000${number}.png`,
      review_mode: "intrinsic_only",
      intended_file: null,
      references: [],
      source_group_id: `srcgrp_000${number}`,
      source_family: "synthetic_batch_pilot",
      character_group_id: null,
      reference_group_id: null,
      target_split: "pilot_unassigned",
    })),
  };
  const sourcePath = path.join(root, "assembly", "review-package.private.json");
  await writeFile(sourcePath, JSON.stringify(source));
  for (const slot of ["reviewer_a", "reviewer_b"]) {
    const output = path.join(root, "human-review-packages", `${slot}.zip`);
    await execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "build-manga-quality-review-package.mjs"), "--root", root, "--source", sourcePath, "--slot", slot, "--output", output], { cwd: repositoryRoot });
    const validated = await execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "validate-manga-quality-review-package.mjs"), "--package", output], { cwd: repositoryRoot });
    assert.match(validated.stdout, /REVIEW_PACKAGE_VALID/);
    const zip = await JSZip.loadAsync(await readFile(output));
    assert.equal(zip.file("labels.private.json"), null);
    assert.ok(zip.file("cases/case_000001/candidate.png"));
    const manifest = JSON.parse(await zip.file("package-manifest.json").async("string"));
    assert.equal(manifest.review_scope, "PILOT_INTRINSIC_ONLY");
    assert.equal(manifest.formal_benchmark_eligible, false);
  }
});

test("referential package carries a sanitized Panel Specification and bound identity reference", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a4-referential-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "assembly", "images"), { recursive: true });
  await mkdir(path.join(root, "assembly", "refs"), { recursive: true });
  await mkdir(path.join(root, "assembly", "intended"), { recursive: true });
  await sharp({ create: { width: 32, height: 48, channels: 3, background: "#554433" } }).png().toFile(path.join(root, "assembly", "images", "img_0001.png"));
  await sharp({ create: { width: 32, height: 48, channels: 3, background: "#335577" } }).png().toFile(path.join(root, "assembly", "refs", "ref_0001.png"));
  const originalPanelId = "11111111-1111-4111-8111-111111111111";
  const intended = {
    version: 1,
    panelId: originalPanelId,
    characterNames: ["人物A"],
    characterIdentities: [{
      version: 1,
      characterId: "22222222-2222-4222-8222-222222222222",
      displayName: "人物A",
      ageRange: "成人",
      bodyType: "標準",
      heightClass: "中",
      faceSummary: "短髪",
      hairStyle: "短髪",
      hairColor: "黒",
      eyeColor: "黒",
      skinTone: "標準",
      defaultOutfit: "ジャケット",
      alternateOutfits: [],
      distinguishingFeatures: [],
      identityReferenceImages: [],
      expressionReferenceImages: [],
      fullBodyReferenceImages: [],
      lockedAttributes: ["hairStyle"],
    }],
    expectedCharacterCount: 1,
    expression: "落ち着いた表情",
    composition: "人物と展示物の関係が分かる中景",
    background: "美術館展示室",
    props: ["展示台"],
    action: "展示物を見る",
    shot: "medium",
    cameraAngle: "eye_level",
    generationTarget: "composite",
  };
  await writeFile(path.join(root, "assembly", "intended", "img_0001.json"), JSON.stringify(intended));
  const source = {
    source_version: 1,
    benchmark_version: "2.1",
    package_id: "r4_3a4_referential_test",
    review_scope: "FORMAL_CANDIDATE",
    formal_benchmark_eligible: true,
    cases: [{
      source_case_id: "img_0001",
      review_case_id: "case_000001",
      candidate_file: "assembly/images/img_0001.png",
      review_mode: "referential",
      intended_file: "assembly/intended/img_0001.json",
      references: [{ reference_id: "ref_01", role: "character_identity", character_index: 0, file: "assembly/refs/ref_0001.png" }],
      source_group_id: "srcgrp_0001",
      source_family: "synthetic_batch_formal_a",
      character_group_id: "chargrp_0001",
      reference_group_id: "refgrp_0001",
      target_split: "dev",
    }],
  };
  const sourcePath = path.join(root, "assembly", "review-package.private.json");
  await writeFile(sourcePath, JSON.stringify(source));
  const output = path.join(root, "human-review-packages", "reviewer-b.zip");
  await execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "build-manga-quality-review-package.mjs"), "--root", root, "--source", sourcePath, "--slot", "reviewer_b", "--output", output], { cwd: repositoryRoot });
  const validated = await execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "validate-manga-quality-review-package.mjs"), "--package", output], { cwd: repositoryRoot });
  assert.match(validated.stdout, /REVIEW_PACKAGE_VALID/);
  const zip = await JSZip.loadAsync(await readFile(output));
  const packageIntended = JSON.parse(await zip.file("cases/case_000001/intended.json").async("string"));
  const manifest = JSON.parse(await zip.file("package-manifest.json").async("string"));
  assert.notEqual(packageIntended.panelId, originalPanelId);
  assert.equal(packageIntended.characterIdentities[0].identityReferenceImages[0], manifest.cases[0].references[0].binding_id);
  assert.equal(manifest.cases[0].allowed_defect_categories.includes("character_identity_mismatch"), true);
});

test("generator and validator reject metadata, URL credentials, and private-answer leakage", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a4-leak-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const imageDir = path.join(root, "assembly", "images");
  await mkdir(imageDir, { recursive: true });
  await sharp({ create: { width: 32, height: 48, channels: 3, background: "#884422" } })
    .withMetadata({ comment: "generation prompt" })
    .png()
    .toFile(path.join(imageDir, "img_0001.png"));
  const source = {
    source_version: 1,
    benchmark_version: "2.1",
    package_id: "r4_3a4_leak_test",
    review_scope: "PILOT_INTRINSIC_ONLY",
    formal_benchmark_eligible: false,
    cases: [{
      source_case_id: "img_0001",
      review_case_id: "case_000001",
      candidate_file: "assembly/images/img_0001.png",
      review_mode: "intrinsic_only",
      intended_file: null,
      references: [],
      source_group_id: "srcgrp_0001",
      source_family: "synthetic_batch_pilot",
      character_group_id: null,
      reference_group_id: null,
      target_split: "pilot_unassigned",
    }],
  };
  const sourcePath = path.join(root, "assembly", "review-package.private.json");
  await writeFile(sourcePath, JSON.stringify(source));
  const output = path.join(root, "human-review-packages", "metadata.zip");
  await assert.rejects(
    execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "build-manga-quality-review-package.mjs"), "--root", root, "--source", sourcePath, "--slot", "reviewer_b", "--output", output], { cwd: repositoryRoot }),
    /image_metadata_forbidden/,
  );

  const zip = new JSZip();
  zip.file("README_JA.md", "https://example.com/?X-Amz-Signature=secret");
  zip.file("package-manifest.json", JSON.stringify({ ...packageManifest(), expected_label: "bad", reviewer_a_result: "good" }));
  zip.file("review-order.txt", "case_000001\n");
  zip.file("review-response.private.json", "{}");
  const leaked = path.join(root, "human-review-packages", "leaked.zip");
  await mkdir(path.dirname(leaked), { recursive: true });
  await writeFile(leaked, await zip.generateAsync({ type: "nodebuffer" }));
  await assert.rejects(
    execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "validate-manga-quality-review-package.mjs"), "--package", leaked], { cwd: repositoryRoot }),
    /forbidden_value|private_label_leakage/,
  );
});

test("response validator accepts a complete human response", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a4-response-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const zip = new JSZip();
  zip.file("package-manifest.json", JSON.stringify(packageManifest()));
  const packagePath = path.join(root, "reviewer-b.zip");
  await writeFile(packagePath, await zip.generateAsync({ type: "nodebuffer" }));
  const responsePath = path.join(root, "response.json");
  await writeFile(responsePath, JSON.stringify(completedResponse()));
  const result = await execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "validate-manga-quality-review-response.mjs"), "--package", packagePath, "--response", responsePath], { cwd: repositoryRoot });
  assert.match(result.stdout, /REVIEW_RESPONSE_VALID/);
});

test("package validator rejects zip traversal before extraction", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "mangai-r4-3a4-security-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const zip = new JSZip();
  zip.file("../escape.txt", "blocked");
  const packagePath = path.join(root, "malicious.zip");
  await writeFile(packagePath, await zip.generateAsync({ type: "nodebuffer" }));
  await assert.rejects(
    execFileAsync(process.execPath, [...nodeArgs, path.join(repositoryRoot, "scripts", "validate-manga-quality-review-package.mjs"), "--package", packagePath], { cwd: repositoryRoot }),
    /review_package_zip_traversal|review_package_expected_file_missing/,
  );
});

test("runtime quality failure enum is not modified or forced into the human review schema", async () => {
  const runtime = await readFile(path.join(repositoryRoot, "src", "modules", "manga-quality", "domain", "visual-judge-failure.ts"), "utf8");
  const human = await readFile(path.join(repositoryRoot, "src", "modules", "manga-quality", "domain", "human-review-package.ts"), "utf8");
  assert.doesNotMatch(runtime, /anatomy_hand_error|prop_missing/);
  assert.doesNotMatch(human, /from "\.\/visual-judge-failure/);
});
