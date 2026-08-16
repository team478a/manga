import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";
import {
  humanReviewPackageManifestSchema,
  humanReviewPackageSourceSidecarSchema,
  humanReviewPanelSpecificationSchema,
  humanReviewResponseTemplateSchema,
} from "../src/modules/manga-quality/domain/human-review-package.ts";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const option = (name) => argument(name) ?? process.env[`npm_config_${name.slice(2).replaceAll("-", "_")}`];
const positional = process.argv.slice(2).filter((value, index, values) => !value.startsWith("--") && !values[index - 1]?.startsWith("--"));
const packageArgument = option("--package") ?? positional[0];
if (!packageArgument) throw new Error("review_package_path_required");
const packagePath = path.resolve(packageArgument);
const sidecarPath = path.resolve(option("--source-metadata") ?? positional[1] ?? packagePath.replace(/\.zip$/i, ".source-metadata.private.json"));
const forbiddenText = /https?:\/\/|(?:^|[^a-z])sk-(?:proj-)?[a-z0-9_-]{8,}|(?:token|signature|signed_url|x-amz-signature)\s*[:=]/i;
const forbiddenKeys = new Set([
  "expected_label",
  "expected_severity",
  "expected_defects",
  "reviewer_a_result",
  "reviewer_a_verdict",
  "ai_judge",
  "ai_result",
  "prompt",
  "good_prompt",
  "bad_prompt",
  "source_generation_purpose",
  "split",
  "labels",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertSafeEntry(entry) {
  const raw = entry.unsafeOriginalName ?? entry.name;
  const normalized = raw.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized) || normalized.split("/").includes(".."))
    throw new Error(`review_package_zip_traversal:${raw}`);
  const mode = typeof entry.unixPermissions === "number" ? entry.unixPermissions & 0o170000 : 0;
  if (mode === 0o120000) throw new Error(`review_package_symlink_forbidden:${raw}`);
}

function inspectJsonKeys(value, location) {
  if (Array.isArray(value)) return value.forEach((item, index) => inspectJsonKeys(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key.toLowerCase())) throw new Error(`review_package_private_label_leakage:${location}:${key}`);
    inspectJsonKeys(child, `${location}.${key}`);
  }
}

function inspectPngChunks(bytes, label) {
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error(`review_package_png_chunk_invalid:${label}`);
    if (["tEXt", "zTXt", "iTXt", "eXIf"].includes(type)) throw new Error(`review_package_image_metadata_forbidden:${label}`);
    offset = end;
    if (type === "IEND") break;
  }
}

async function inspectImage(bytes, label) {
  inspectPngChunks(bytes, label);
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format ?? "")) throw new Error(`review_package_image_format_forbidden:${label}`);
  if (metadata.exif || metadata.xmp || metadata.iptc) throw new Error(`review_package_image_metadata_forbidden:${label}`);
  await image.clone().raw().toBuffer();
}

async function readZipText(zip, name) {
  const entry = zip.file(name);
  if (!entry) throw new Error(`review_package_expected_file_missing:${name}`);
  const text = await entry.async("string");
  if (forbiddenText.test(text)) throw new Error(`review_package_forbidden_value:${name}`);
  return text;
}

async function readZipJson(zip, name) {
  const value = JSON.parse(await readZipText(zip, name));
  inspectJsonKeys(value, name);
  return value;
}

async function main() {
  const packageBytes = await readFile(packagePath);
  const zip = await JSZip.loadAsync(packageBytes, { checkCRC32: true, createFolders: true });
  const entries = Object.values(zip.files);
  entries.forEach(assertSafeEntry);
  const manifest = humanReviewPackageManifestSchema.parse(await readZipJson(zip, "package-manifest.json"));
  const template = humanReviewResponseTemplateSchema.parse(await readZipJson(zip, "review-response.private.json"));
  const order = (await readZipText(zip, "review-order.txt")).trim().split(/\r?\n/).filter(Boolean);
  await readZipText(zip, "README_JA.md");
  if (template.slot !== manifest.slot) throw new Error("review_package_template_slot_mismatch");
  if (new Set(order).size !== order.length) throw new Error("review_package_order_duplicate_case");
  const expectedIds = new Set(manifest.cases.map((item) => item.case_id));
  if (order.length !== expectedIds.size || order.some((id) => !expectedIds.has(id)))
    throw new Error("review_package_order_case_set_mismatch");
  if (template.records.length !== order.length || template.records.some((record, index) => record.case_id !== order[index]))
    throw new Error("review_package_template_order_mismatch");

  const expectedFiles = new Set(["README_JA.md", "package-manifest.json", "review-order.txt", "review-response.private.json"]);
  const candidateHashes = new Map();
  for (const item of manifest.cases) {
    expectedFiles.add(item.candidate_file);
    const candidate = zip.file(item.candidate_file);
    if (!candidate) throw new Error(`review_package_expected_file_missing:${item.candidate_file}`);
    const candidateBytes = await candidate.async("nodebuffer");
    await inspectImage(candidateBytes, item.candidate_file);
    if (sha256(candidateBytes) !== item.candidate_sha256) throw new Error(`review_package_checksum_mismatch:${item.candidate_file}`);
    const duplicate = candidateHashes.get(item.candidate_sha256);
    if (duplicate) throw new Error(`review_package_exact_duplicate:${duplicate}:${item.case_id}`);
    candidateHashes.set(item.candidate_sha256, item.case_id);
    if (item.intended_file) {
      expectedFiles.add(item.intended_file);
      const intendedBytes = await zip.file(item.intended_file)?.async("nodebuffer");
      if (!intendedBytes) throw new Error(`review_package_expected_file_missing:${item.intended_file}`);
      if (sha256(intendedBytes) !== item.intended_sha256) throw new Error(`review_package_checksum_mismatch:${item.intended_file}`);
      const intended = JSON.parse(intendedBytes.toString("utf8"));
      inspectJsonKeys(intended, item.intended_file);
      const specification = humanReviewPanelSpecificationSchema.parse(intended);
      const identityBindingIds = new Set(specification.characterIdentities.flatMap((identity) => [
        ...identity.identityReferenceImages,
        ...identity.expressionReferenceImages,
        ...identity.fullBodyReferenceImages,
      ]));
      for (const reference of item.references.filter((value) => value.role.startsWith("character_")))
        if (!reference.binding_id || !identityBindingIds.has(reference.binding_id))
          throw new Error(`review_package_reference_binding_missing:${reference.reference_id}`);
    }
    for (const reference of item.references) {
      expectedFiles.add(reference.file);
      const referenceBytes = await zip.file(reference.file)?.async("nodebuffer");
      if (!referenceBytes) throw new Error(`review_package_expected_file_missing:${reference.file}`);
      await inspectImage(referenceBytes, reference.file);
      if (sha256(referenceBytes) !== reference.sha256) throw new Error(`review_package_checksum_mismatch:${reference.file}`);
    }
  }
  for (const entry of entries) {
    if (entry.dir) continue;
    if (!expectedFiles.has(entry.name)) throw new Error(`review_package_unexpected_file:${entry.name}`);
  }
  const sourceText = await readFile(sidecarPath, "utf8");
  if (forbiddenText.test(sourceText)) throw new Error("review_package_source_metadata_forbidden_value");
  const sidecar = humanReviewPackageSourceSidecarSchema.parse(JSON.parse(sourceText));
  if (sidecar.package_sha256 !== sha256(packageBytes)) throw new Error("review_package_source_metadata_checksum_mismatch");
  if (sidecar.package_id !== manifest.package_id || sidecar.review_scope !== manifest.review_scope)
    throw new Error("review_package_source_metadata_package_mismatch");
  const sidecarIds = new Set(sidecar.cases.map((item) => item.case_id));
  if (sidecarIds.size !== expectedIds.size || [...expectedIds].some((id) => !sidecarIds.has(id)))
    throw new Error("review_package_source_metadata_case_set_mismatch");
  const splitsByFamily = new Map();
  for (const item of sidecar.cases) {
    const splits = splitsByFamily.get(item.source_family) ?? new Set();
    splits.add(item.target_split);
    splitsByFamily.set(item.source_family, splits);
  }
  if ([...splitsByFamily.values()].some((splits) => splits.has("dev") && splits.has("holdout_private")))
    throw new Error("review_package_source_family_crosses_split");
  process.stdout.write(`${JSON.stringify({
    status: "REVIEW_PACKAGE_VALID",
    packageVersion: manifest.package_version,
    packageId: manifest.package_id,
    slot: manifest.slot,
    cases: manifest.case_count,
    reviewScope: manifest.review_scope,
    formalBenchmarkEligible: manifest.formal_benchmark_eligible,
    sourceMetadata: "VALID_PRIVATE_SIDECAR",
    privateLabelLeakage: 0,
    reviewerALeakage: 0,
    productionChanged: false,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`manga quality review package validation failed: ${error instanceof Error ? error.message : "unknown_error"}\n`);
  process.exitCode = 1;
});
