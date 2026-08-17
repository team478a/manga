import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import {
  buildSecureReviewTransferHtml,
  decodePassphraseFile,
  encryptReviewPackage,
  SECURE_REVIEW_TRANSFER_VERSION,
  sha256,
} from "./lib/manga-quality-secure-review-transfer.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const packageArgument = argument("--package") ?? process.argv[2];
const passphraseArgument = argument("--passphrase-file") ?? process.argv[3];
const outputArgument = argument("--output") ?? process.argv[4];
if (!packageArgument || !passphraseArgument || !outputArgument) throw new Error("review_transfer_required_arguments_missing");
const packagePath = path.resolve(packageArgument);
const passphrasePath = path.resolve(passphraseArgument);
const outputPath = path.resolve(outputArgument);
const sourceMetadataPath = path.resolve(argument("--source-metadata") ?? packagePath.replace(/\.zip$/i, ".source-metadata.private.json"));
const receiptPath = path.resolve(argument("--receipt") ?? outputPath.replace(/\.html$/i, ".receipt.json"));
const packageKind = argument("--package-kind") ?? "human-review";
const recipientRole = argument("--recipient-role");
const privateMappingArgument = argument("--private-mapping");
if (!recipientRole || !privateMappingArgument) throw new Error("review_transfer_recipient_mapping_required");
const privateMappingPath = path.resolve(privateMappingArgument);

function insideRepository(target) {
  return target === repositoryRoot || target.startsWith(`${repositoryRoot}${path.sep}`);
}
async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}
if (!packagePath.toLowerCase().endsWith(".zip")) throw new Error("review_transfer_package_must_be_zip");
if (packageKind !== "human-review" && packageKind !== "rights-review") throw new Error("review_transfer_package_kind_invalid");
if (!["rights_reviewer", "reviewer_a", "reviewer_b"].includes(recipientRole)) throw new Error("review_transfer_recipient_role_invalid");
if ((packageKind === "rights-review") !== (recipientRole === "rights_reviewer")) throw new Error("review_transfer_recipient_kind_mismatch");
if (!outputPath.toLowerCase().endsWith(".html")) throw new Error("review_transfer_output_must_be_html");
if (insideRepository(packagePath) || insideRepository(passphrasePath) || insideRepository(outputPath) || insideRepository(receiptPath) || insideRepository(privateMappingPath))
  throw new Error("review_transfer_private_files_must_be_outside_repository");
if (await exists(outputPath) || await exists(receiptPath) || await exists(privateMappingPath)) throw new Error("review_transfer_output_exists_no_overwrite");

const validationArguments = packageKind === "human-review"
  ? ["--experimental-strip-types", path.join(repositoryRoot, "scripts", "validate-manga-quality-review-package.mjs"), "--package", packagePath, "--source-metadata", sourceMetadataPath]
  : [path.join(repositoryRoot, "scripts", "validate-manga-quality-rights-review-package.mjs"), "--package", packagePath];
await execFileAsync(process.execPath, validationArguments, { cwd: repositoryRoot });
const packageBytes = await readFile(packagePath);
const packageZip = await JSZip.loadAsync(packageBytes);
const packageManifest = JSON.parse(await packageZip.file("package-manifest.json").async("string"));
if (packageKind === "human-review" && packageManifest.slot !== recipientRole) throw new Error("review_transfer_recipient_slot_mismatch");
const passphrase = decodePassphraseFile(await readFile(passphrasePath, "utf8"));
const envelope = await encryptReviewPackage(packageBytes, passphrase);
const html = buildSecureReviewTransferHtml(envelope);
const transferId = randomUUID();
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, { flag: "wx" });
const receipt = {
  version: SECURE_REVIEW_TRANSFER_VERSION,
  transfer_id: transferId,
  envelope_sha256: sha256(Buffer.from(html)),
  encrypted_payload_sha256: envelope.payload.sha256,
  encrypted_payload_bytes: envelope.payload.byte_length,
  network_access: false,
  secret_in_receipt: false,
};
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
await mkdir(path.dirname(privateMappingPath), { recursive: true });
await writeFile(privateMappingPath, `${JSON.stringify({
  version: SECURE_REVIEW_TRANSFER_VERSION,
  transfer_id: transferId,
  recipient_role: recipientRole,
  source_package_sha256: envelope.payload.sha256,
  envelope_file: path.basename(outputPath),
  receipt_file: path.basename(receiptPath),
  passphrase_file: path.basename(passphrasePath),
  private_mapping: true,
}, null, 2)}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`${JSON.stringify({ status: "REVIEW_TRANSFER_CREATED", transferId, envelope: outputPath, receipt: receiptPath, secretPrinted: false, productionChanged: false }, null, 2)}\n`);
