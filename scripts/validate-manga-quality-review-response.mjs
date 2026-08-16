import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import {
  humanReviewPackageManifestSchema,
  validateHumanReviewResponseForPackage,
} from "../src/modules/manga-quality/domain/human-review-package.ts";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const option = (name) => argument(name) ?? process.env[`npm_config_${name.slice(2).replaceAll("-", "_")}`];
const positional = process.argv.slice(2).filter((value, index, values) => !value.startsWith("--") && !values[index - 1]?.startsWith("--"));
const packageArgument = option("--package") ?? positional[0];
const responseArgument = option("--response") ?? positional[1];
if (!packageArgument || !responseArgument) throw new Error("review_package_and_response_paths_required");

try {
  const zip = await JSZip.loadAsync(await readFile(path.resolve(packageArgument)), { checkCRC32: true });
  const manifestEntry = zip.file("package-manifest.json");
  if (!manifestEntry) throw new Error("review_package_manifest_missing");
  const manifest = humanReviewPackageManifestSchema.parse(JSON.parse(await manifestEntry.async("string")));
  const response = JSON.parse(await readFile(path.resolve(responseArgument), "utf8"));
  const inspection = validateHumanReviewResponseForPackage(response, manifest);
  if (!inspection.valid) throw new Error(inspection.reasons.join(","));
  process.stdout.write(`${JSON.stringify({
    status: "REVIEW_RESPONSE_VALID",
    packageId: manifest.package_id,
    slot: inspection.response.slot,
    reviewerKind: inspection.response.reviewer_kind,
    independent: inspection.response.independent,
    records: inspection.response.records.length,
    productionChanged: false,
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`manga quality review response validation failed: ${error instanceof Error ? error.message : "unknown_error"}\n`);
  process.exitCode = 1;
}
