import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fromEnv = (name, fallback) => path.resolve(process.env[name] ?? path.join(root, fallback));
const paths = {
  rc: fromEnv("MANGAI_ADULT_PILOT_RC_STATUS_PATH", "docs/desktop/RC_ACCEPTANCE_STATUS.json"),
  bundle: fromEnv("MANGAI_ADULT_PILOT_BUNDLE_PATH", "docs/desktop/DESKTOP_ADULT_PILOT_BUNDLE.json"),
  hardware: fromEnv("MANGAI_PHASE5_HARDWARE_STATUS_PATH", "docs/desktop/PHASE5_HARDWARE_ACCEPTANCE.json"),
  approvals: fromEnv("MANGAI_ADULT_PILOT_RELEASE_APPROVALS_PATH", "docs/desktop/DESKTOP_ADULT_PILOT_RELEASE_APPROVALS.json"),
};
const read = (file, label) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { console.error(`Desktop Adult pilot readiness invalid: ${label} could not be read`); process.exit(1); }
};
const exists = (relative) => fs.statSync(path.join(root, relative), { throwIfNoEntry: false })?.isFile() === true;
const rc = read(paths.rc, "RC status"), bundle = read(paths.bundle, "bundle"), hardware = read(paths.hardware, "hardware"), approvals = read(paths.approvals, "approvals");
if (approvals.format !== "mangai.desktop-adult-pilot-release-approvals" || approvals.version !== 1)
  { console.error("Desktop Adult pilot readiness invalid: approvals format is unsupported"); process.exit(1); }

const rcStatus = (id) => rc.requirements?.find((item) => item.id === id)?.status;
const bundleItems = [bundle.comfyui, ...(bundle.workflows ?? []), ...(bundle.models ?? [])];
const bundleReady = bundleItems.length === 8 && bundleItems.every((item) => item?.status === "fixed");
const profile = hardware.profiles?.find((item) => item.profile === "vram_12gb");
const requiredOps = ["text_to_image", "image_to_image", "controlnet", "inpainting"];
const hardwareReady = profile?.status === "passed" && requiredOps.every((operation) => profile.evidence?.some((item) => item.operation === operation && item.result === "passed"));
const timestamp = (value) => typeof value === "string" && value === new Date(value).toISOString();
const approvalsReady = approvals.pilotStartApproved === true && approvals.manualVersionStopConstraintAccepted === true && timestamp(approvals.approvedAt);
const checks = [
  ["signed_artifacts", rcStatus("windows-code-signing") === "passed" && rcStatus("signed-auto-update") === "passed"],
  ["fixed_bundle", bundleReady],
  ["hardware_12gb_four_modes", hardwareReady],
  ["consent_and_local_boundary", exists("docs/desktop/DESKTOP_ADULT_PRIVATE_MONITOR_RELEASE_PLAN_20260831.md")],
  ["diagnostic_privacy", exists("apps/desktop/tests/diagnostics.test.mjs")],
  ["stop_recovery_runbook", exists("docs/desktop/DESKTOP_ADULT_PILOT_STOP_RECOVERY_RUNBOOK_20260901.md")],
  ["invite_ledger", exists("apps/desktop/scripts/check-adult-pilot-invite-ledger.mjs") && exists("docs/desktop/DESKTOP_ADULT_PILOT_INVITE_LEDGER.example.json")],
  ["owner_approvals", approvalsReady],
];
for (const [id, ready] of checks) console.log(`${id}: ${ready ? "READY" : "BLOCKED"}`);
const blocked = checks.filter(([, ready]) => !ready).map(([id]) => id);
console.log(`Desktop Adult pilot release readiness: ready=${checks.length - blocked.length}, blocked=${blocked.length}`);
if (blocked.length) console.log(`Blocked: ${blocked.join(", ")}`);
if (process.argv.includes("--strict") && blocked.length) process.exit(1);
