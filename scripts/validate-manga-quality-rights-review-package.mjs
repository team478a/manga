import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateRightsReviewPackage } from "./lib/manga-quality-rights-review.mjs";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const packageArgument = argument("--package") ?? process.argv[2];
if (!packageArgument) throw new Error("rights_review_package_path_required");
const expectedCountValue = argument("--expected-count");
const expectedCount = expectedCountValue === null ? undefined : Number(expectedCountValue);
if (expectedCount !== undefined && (!Number.isSafeInteger(expectedCount) || expectedCount <= 0))
  throw new Error("rights_review_expected_count_invalid");
const requireComplete = process.argv.includes("--require-complete");
const result = await validateRightsReviewPackage(await readFile(path.resolve(packageArgument)), {
  expectedCount,
  requireComplete,
});
process.stdout.write(`${JSON.stringify({
  status: requireComplete ? "RIGHTS_REVIEW_COMPLETE" : "RIGHTS_REVIEW_PACKAGE_VALID",
  cases: result.cases.length,
  packageSha256: result.packageSha256,
  provenanceChecked: true,
  completionChecked: requireComplete,
  secretPrinted: false,
  productionChanged: false,
}, null, 2)}\n`);
