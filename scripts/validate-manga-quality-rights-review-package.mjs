import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const packageArgument = argument("--package") ?? process.argv[2];
if (!packageArgument) throw new Error("rights_review_package_path_required");
const bytes = await readFile(path.resolve(packageArgument));
const zip = await JSZip.loadAsync(bytes);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const forbiddenSecret = /(?:^|[^a-z])sk-(?:proj-)?[a-z0-9_-]{8,}|(?:token|signature|signed_url|x-amz-signature)\s*[:=]/i;

function assertSafeEntry(entry) {
  const raw = entry.unsafeOriginalName ?? entry.name;
  const normalized = raw.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized) || normalized.split("/").includes(".."))
    throw new Error(`rights_review_zip_traversal:${raw}`);
  const mode = typeof entry.unixPermissions === "number" ? entry.unixPermissions & 0o170000 : 0;
  if (mode === 0o120000) throw new Error(`rights_review_symlink_forbidden:${raw}`);
}

for (const entry of Object.values(zip.files)) assertSafeEntry(entry);
const manifestEntry = zip.file("package-manifest.json");
const responseEntry = zip.file("rights-response.private.json");
if (!manifestEntry || !responseEntry || !zip.file("README_JA.md") || !zip.file("provider-terms-evidence.private.md"))
  throw new Error("rights_review_package_required_file_missing");
const manifestText = await manifestEntry.async("string");
const responseText = await responseEntry.async("string");
if (forbiddenSecret.test(manifestText) || forbiddenSecret.test(responseText)) throw new Error("rights_review_package_secret_forbidden");
const manifest = JSON.parse(manifestText);
const response = JSON.parse(responseText);
if (manifest.package_version !== "mangai-rights-review-v1" || manifest.purpose !== "PRIVATE_BENCHMARK_RIGHTS_REVIEW")
  throw new Error("rights_review_package_contract_invalid");
if (!Number.isSafeInteger(manifest.case_count) || manifest.case_count <= 0 || manifest.cases?.length !== manifest.case_count)
  throw new Error("rights_review_package_case_count_invalid");
if (response.template_version !== "mangai-rights-review-response-v1" || response.batch_id !== manifest.batch_id || response.records?.length !== manifest.case_count)
  throw new Error("rights_review_response_contract_invalid");
const responseIds = new Set(response.records.map((item) => item.image_id));
const expectedFiles = new Set(["README_JA.md", "provider-terms-evidence.private.md", "package-manifest.json", "rights-response.private.json"]);
for (const item of manifest.cases) {
  if (!/^img_[0-9]{4}$/.test(item.image_id) || !/^[a-f0-9]{64}$/.test(item.sha256) || !responseIds.has(item.image_id))
    throw new Error(`rights_review_case_invalid:${item.image_id ?? "unknown"}`);
  expectedFiles.add(item.file);
  const image = await zip.file(item.file)?.async("nodebuffer");
  if (!image || sha256(image) !== item.sha256) throw new Error(`rights_review_image_checksum_invalid:${item.image_id}`);
  if (image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error(`rights_review_image_not_png:${item.image_id}`);
  const chunkTypes = new Set();
  let offset = 8;
  while (offset + 12 <= image.length) {
    const length = image.readUInt32BE(offset);
    const type = image.subarray(offset + 4, offset + 8).toString("ascii");
    const end = offset + 12 + length;
    if (end > image.length) throw new Error(`rights_review_png_chunk_invalid:${item.image_id}`);
    chunkTypes.add(type); offset = end; if (type === "IEND") break;
  }
  for (const required of item.required_provenance_chunks ?? [])
    if (!chunkTypes.has(required)) throw new Error(`rights_review_provenance_missing:${item.image_id}:${required}`);
}
for (const entry of Object.values(zip.files))
  if (!entry.dir && !expectedFiles.has(entry.name)) throw new Error(`rights_review_unexpected_file:${entry.name}`);
if (responseIds.size !== manifest.case_count || manifest.cases.some((item) => !responseIds.has(item.image_id)))
  throw new Error("rights_review_response_case_set_invalid");
process.stdout.write(`${JSON.stringify({ status: "RIGHTS_REVIEW_PACKAGE_VALID", cases: manifest.case_count, provenanceChecked: true, secretPrinted: false, productionChanged: false }, null, 2)}\n`);
