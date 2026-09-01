import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const target = path.resolve(
  process.env.MANGAI_ADULT_PILOT_RELEASE_APPROVALS_PATH ??
    path.join(root, "docs/desktop/DESKTOP_ADULT_PILOT_RELEASE_APPROVALS.json"),
);
const required = new Set(["--approve-pilot-start", "--accept-manual-version-stop"]);
const supplied = new Set(process.argv.slice(2));
const fail = (message) => {
  console.error(`Desktop Adult pilot owner approval not recorded: ${message}`);
  process.exit(1);
};
for (const flag of required) if (!supplied.has(flag)) fail(`${flag} is required`);
for (const flag of supplied) if (!required.has(flag)) fail(`unknown argument ${flag}`);

let current;
try { current = JSON.parse(fs.readFileSync(target, "utf8")); }
catch { fail("approval manifest could not be read"); }
if (current.format !== "mangai.desktop-adult-pilot-release-approvals" || current.version !== 1)
  fail("approval manifest format is unsupported");
if (current.pilotStartApproved || current.manualVersionStopConstraintAccepted || current.approvedAt)
  fail("approval manifest is already populated; review it manually");

const next = {
  ...current,
  pilotStartApproved: true,
  manualVersionStopConstraintAccepted: true,
  approvedAt: new Date().toISOString(),
};
const temporary = `${target}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: "wx" });
fs.renameSync(temporary, target);
console.log("Desktop Adult pilot owner approval recorded. Distribution remains blocked by all other gates.");
