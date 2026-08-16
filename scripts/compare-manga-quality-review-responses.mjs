import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import {
  compareHumanReviewResponses,
  humanReviewPackageManifestSchema,
} from "../src/modules/manga-quality/domain/human-review-package.ts";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const option = (name) => argument(name) ?? process.env[`npm_config_${name.slice(2).replaceAll("-", "_")}`];
const positional = process.argv.slice(2).filter((value, index, values) => !value.startsWith("--") && !values[index - 1]?.startsWith("--"));
const packageArgument = option("--package") ?? positional[0];
const reviewerAArgument = option("--reviewer-a") ?? positional[1];
const reviewerBArgument = option("--reviewer-b") ?? positional[2];
if (!packageArgument || !reviewerAArgument || !reviewerBArgument)
  throw new Error("review_package_and_both_response_paths_required");

try {
  const zip = await JSZip.loadAsync(await readFile(path.resolve(packageArgument)), { checkCRC32: true });
  const manifestEntry = zip.file("package-manifest.json");
  if (!manifestEntry) throw new Error("review_package_manifest_missing");
  const manifest = humanReviewPackageManifestSchema.parse(JSON.parse(await manifestEntry.async("string")));
  const reviewerA = JSON.parse(await readFile(path.resolve(reviewerAArgument), "utf8"));
  const reviewerB = JSON.parse(await readFile(path.resolve(reviewerBArgument), "utf8"));
  const comparison = compareHumanReviewResponses(reviewerA, reviewerB, manifest);
  if (!comparison.valid) throw new Error(comparison.reasons.join(","));
  process.stdout.write(`${JSON.stringify({
    status: comparison.disagreement_count === 0 ? "DUAL_REVIEW_AGREED" : "ADJUDICATION_REQUIRED",
    ...comparison,
    autoMajorityDecision: false,
    productionChanged: false,
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`manga quality review response comparison failed: ${error instanceof Error ? error.message : "unknown_error"}\n`);
  process.exitCode = 1;
}
