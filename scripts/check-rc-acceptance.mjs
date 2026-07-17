import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readAcceptanceRecord,
  summarizeAcceptance,
} from "./lib/rc-acceptance.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recordPath = path.join(
  root,
  "docs",
  "desktop",
  "RC_ACCEPTANCE_STATUS.json",
);
const strict = process.argv.slice(2).includes("--strict");

let result;
try {
  result = readAcceptanceRecord(recordPath);
} catch (error) {
  console.error(`RC acceptance record could not be read: ${error.message}`);
  process.exit(1);
}

if (result.errors.length > 0) {
  console.error("RC acceptance record is invalid:");
  for (const error of result.errors) console.error(`  - ${error}`);
  process.exit(1);
}

const summary = summarizeAcceptance(result.document);
console.log(
  `MANGAI RC ${result.document.releaseVersion}: ${summary.counts.passed} passed, ${summary.counts.waived} waived, ${summary.counts.pending} pending, ${summary.counts.blocked} blocked`,
);
for (const requirement of result.document.requirements) {
  const detail = requirement.reason ? ` - ${requirement.reason}` : "";
  console.log(`  [${requirement.status}] ${requirement.label}${detail}`);
}

if (strict && !summary.complete) {
  console.error("RC acceptance is incomplete.");
  process.exit(1);
}
