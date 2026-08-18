import { createHash } from "node:crypto";
import JSZip from "jszip";
import sharp from "sharp";

export const RIGHTS_REVIEW_PACKAGE_VERSION = "mangai-rights-review-v1";
export const RIGHTS_REVIEW_RESPONSE_VERSION = "mangai-rights-review-response-v1";

const forbiddenSecret = /(?:^|[^a-z])sk-(?:proj-)?[a-z0-9_-]{8,}|(?:token|signature|signed_url|x-amz-signature)\s*[:=]/i;
const offsetIso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafeEntry(entry) {
  const raw = entry.unsafeOriginalName ?? entry.name;
  const normalized = raw.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized) || normalized.split("/").includes(".."))
    throw new Error(`rights_review_zip_traversal:${raw}`);
  const mode = typeof entry.unixPermissions === "number" ? entry.unixPermissions & 0o170000 : 0;
  if (mode === 0o120000) throw new Error(`rights_review_symlink_forbidden:${raw}`);
}

function inspectPngChunks(image, imageId) {
  if (image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    throw new Error(`rights_review_image_not_png:${imageId}`);
  const chunkTypes = new Set();
  let offset = 8;
  while (offset + 12 <= image.length) {
    const length = image.readUInt32BE(offset);
    const type = image.subarray(offset + 4, offset + 8).toString("ascii");
    const end = offset + 12 + length;
    if (end > image.length) throw new Error(`rights_review_png_chunk_invalid:${imageId}`);
    chunkTypes.add(type);
    if (["tEXt", "zTXt", "iTXt", "eXIf"].includes(type))
      throw new Error(`rights_review_image_metadata_forbidden:${imageId}:${type}`);
    offset = end;
    if (type === "IEND") break;
  }
  return chunkTypes;
}

function assertCompletedResponse(response, manifest) {
  if (typeof response.verified_by !== "string" || response.verified_by.trim().length < 3 || response.verified_by.length > 120)
    throw new Error("rights_review_verified_by_required");
  if (typeof response.verified_at !== "string" || !offsetIso8601.test(response.verified_at) || !Number.isFinite(Date.parse(response.verified_at)))
    throw new Error("rights_review_verified_at_invalid");
  if (Date.parse(response.verified_at) > Date.now() + 5 * 60_000)
    throw new Error("rights_review_verified_at_future");
  if (response.terms_reviewed !== true) throw new Error("rights_review_terms_not_confirmed");

  const recordsById = new Map(response.records.map((record) => [record.image_id, record]));
  for (const item of manifest.cases) {
    const record = recordsById.get(item.image_id);
    if (!record || record.decision !== "approved")
      throw new Error(`rights_review_case_not_approved:${item.image_id}`);
    for (const field of [
      "provider_terms_confirmed",
      "benchmark_use_approved",
      "no_customer_or_production_content",
      "no_personal_information",
      "no_adult_content",
    ]) {
      if (record[field] !== true) throw new Error(`rights_review_case_attestation_missing:${item.image_id}:${field}`);
    }
    if (record.notes !== undefined && (typeof record.notes !== "string" || record.notes.length > 1000))
      throw new Error(`rights_review_case_notes_invalid:${item.image_id}`);
  }
}

export async function validateRightsReviewPackage(packageBytes, options = {}) {
  const zip = await JSZip.loadAsync(packageBytes);
  for (const entry of Object.values(zip.files)) assertSafeEntry(entry);

  const manifestEntry = zip.file("package-manifest.json");
  const responseEntry = zip.file("rights-response.private.json");
  if (!manifestEntry || !responseEntry || !zip.file("README_JA.md") || !zip.file("provider-terms-evidence.private.md"))
    throw new Error("rights_review_package_required_file_missing");

  const manifestText = await manifestEntry.async("string");
  const responseText = await responseEntry.async("string");
  if (forbiddenSecret.test(manifestText) || forbiddenSecret.test(responseText))
    throw new Error("rights_review_package_secret_forbidden");
  const manifest = JSON.parse(manifestText);
  const response = JSON.parse(responseText);
  if (manifest.package_version !== RIGHTS_REVIEW_PACKAGE_VERSION || manifest.purpose !== "PRIVATE_BENCHMARK_RIGHTS_REVIEW")
    throw new Error("rights_review_package_contract_invalid");
  if (!Number.isSafeInteger(manifest.case_count) || manifest.case_count <= 0 || manifest.cases?.length !== manifest.case_count)
    throw new Error("rights_review_package_case_count_invalid");
  if (options.expectedCount !== undefined && manifest.case_count !== options.expectedCount)
    throw new Error(`rights_review_package_expected_count_mismatch:${manifest.case_count}:${options.expectedCount}`);
  if (response.template_version !== RIGHTS_REVIEW_RESPONSE_VERSION || response.batch_id !== manifest.batch_id || response.records?.length !== manifest.case_count)
    throw new Error("rights_review_response_contract_invalid");

  const responseIds = new Set(response.records.map((item) => item.image_id));
  const manifestIds = new Set(manifest.cases.map((item) => item.image_id));
  const manifestFiles = new Set(manifest.cases.map((item) => item.file));
  if (manifestIds.size !== manifest.case_count || manifestFiles.size !== manifest.case_count
    || [...responseIds].some((imageId) => !manifestIds.has(imageId)))
    throw new Error("rights_review_case_set_not_unique");
  const expectedFiles = new Set(["README_JA.md", "provider-terms-evidence.private.md", "package-manifest.json", "rights-response.private.json"]);
  const cases = [];
  const imageHashes = new Set();
  for (const item of manifest.cases) {
    if (!/^img_[0-9]{4}$/.test(item.image_id) || !/^[a-f0-9]{64}$/.test(item.sha256) || !responseIds.has(item.image_id))
      throw new Error(`rights_review_case_invalid:${item.image_id ?? "unknown"}`);
    if (typeof item.file !== "string" || !/^images\/img_[0-9]{4}\.png$/.test(item.file))
      throw new Error(`rights_review_case_file_invalid:${item.image_id}`);
    expectedFiles.add(item.file);
    const image = await zip.file(item.file)?.async("nodebuffer");
    if (!image || sha256(image) !== item.sha256) throw new Error(`rights_review_image_checksum_invalid:${item.image_id}`);
    if (options.requireComplete && image.length > 8 * 1024 * 1024)
      throw new Error(`rights_review_image_too_large:${item.image_id}`);
    const chunkTypes = inspectPngChunks(image, item.image_id);
    for (const required of item.required_provenance_chunks ?? [])
      if (!chunkTypes.has(required)) throw new Error(`rights_review_provenance_missing:${item.image_id}:${required}`);
    const metadata = await sharp(image, { failOn: "error" }).metadata();
    if (metadata.format !== "png" || !metadata.width || !metadata.height || metadata.width > 20_000 || metadata.height > 20_000
      || (options.requireComplete && (metadata.width < 100 || metadata.height < 100)))
      throw new Error(`rights_review_image_dimensions_invalid:${item.image_id}`);
    imageHashes.add(item.sha256);
    cases.push({
      imageId: item.image_id,
      bytes: image,
      sha256: item.sha256,
      width: metadata.width,
      height: metadata.height,
    });
  }
  for (const entry of Object.values(zip.files))
    if (!entry.dir && !expectedFiles.has(entry.name)) throw new Error(`rights_review_unexpected_file:${entry.name}`);
  if (responseIds.size !== manifest.case_count || manifest.cases.some((item) => !responseIds.has(item.image_id)))
    throw new Error("rights_review_response_case_set_invalid");
  if (options.requireComplete && imageHashes.size !== manifest.case_count)
    throw new Error("rights_review_exact_duplicate_forbidden");
  if (options.requireComplete) assertCompletedResponse(response, manifest);

  return {
    manifest,
    response,
    packageSha256: sha256(packageBytes),
    cases,
    complete: Boolean(options.requireComplete),
  };
}
