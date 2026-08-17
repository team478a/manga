import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { humanReviewPackageManifestSchema } from "../src/modules/manga-quality/domain/human-review-package.ts";
import { decodePassphraseFile, decryptReviewPackage, SECURE_REVIEW_TRANSFER_VERSION } from "./lib/manga-quality-secure-review-transfer.mjs";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const envelopeArgument = argument("--envelope") ?? process.argv[2];
const passphraseArgument = argument("--passphrase-file") ?? process.argv[3];
if (!envelopeArgument || !passphraseArgument) throw new Error("review_transfer_validation_arguments_missing");
const html = await readFile(path.resolve(envelopeArgument), "utf8");
if (!html.includes("connect-src 'none'") || /https?:\/\//i.test(html)) throw new Error("review_transfer_network_policy_invalid");
const match = html.match(/<script id="mangai-secure-review-data" type="application\/json">([\s\S]*?)<\/script>/);
if (!match) throw new Error("review_transfer_envelope_missing");
const envelope = JSON.parse(match[1]);
const passphrase = decodePassphraseFile(await readFile(path.resolve(passphraseArgument), "utf8"));
const packageBytes = await decryptReviewPackage(envelope, passphrase);
const zip = await JSZip.loadAsync(packageBytes);
const manifestEntry = zip.file("package-manifest.json");
if (!manifestEntry) throw new Error("review_transfer_inner_package_incomplete");
const rawManifest = JSON.parse(await manifestEntry.async("string"));
let packageVersion;
let cases;
if (rawManifest.package_version === "mangai-rights-review-v1") {
  if (!zip.file("rights-response.private.json") || rawManifest.purpose !== "PRIVATE_BENCHMARK_RIGHTS_REVIEW")
    throw new Error("review_transfer_inner_rights_package_invalid");
  packageVersion = rawManifest.package_version;
  cases = rawManifest.case_count;
} else {
  const manifest = humanReviewPackageManifestSchema.parse(rawManifest);
  if (!zip.file("review.html") || !zip.file("review-response.private.json")) throw new Error("review_transfer_inner_package_incomplete");
  packageVersion = manifest.package_version;
  cases = manifest.case_count;
}
process.stdout.write(`${JSON.stringify({ status: "REVIEW_TRANSFER_VALID", version: SECURE_REVIEW_TRANSFER_VERSION, packageVersion, cases, payloadSha256: envelope.payload.sha256, secretPrinted: false, productionChanged: false }, null, 2)}\n`);
