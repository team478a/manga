import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const bundlePath = path.resolve(
  process.env.MANGAI_ADULT_PILOT_BUNDLE_PATH ??
    path.join(root, "docs", "desktop", "DESKTOP_ADULT_PILOT_BUNDLE.json"),
);
const hardwarePath = path.resolve(
  process.env.MANGAI_PHASE5_HARDWARE_STATUS_PATH ??
    path.join(root, "docs", "desktop", "PHASE5_HARDWARE_ACCEPTANCE.json"),
);
const strict = process.argv.includes("--strict");
const requiredOperations = [
  "text_to_image",
  "image_to_image",
  "controlnet",
  "inpainting",
];
const requiredModelRoles = ["checkpoint", "vae", "controlnet"];
const sha256Pattern = /^[0-9a-f]{64}$/;

const fail = (message) => {
  console.error(`Desktop Adult pilot bundle invalid: ${message}`);
  process.exit(1);
};
const readJson = (file, label) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    fail(`${label} could not be read`);
  }
};
const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
const fixedArtifact = (item, fields) =>
  item?.status === "fixed" &&
  fields.every((field) => typeof item[field] === "string" && item[field].trim()) &&
  sha256Pattern.test(item.sha256 ?? "") &&
  Number.isSafeInteger(item.installedBytes) &&
  item.installedBytes > 0;

const bundle = readJson(bundlePath, "bundle manifest");
if (
  bundle.format !== "mangai.desktop-adult-pilot-bundle" ||
  bundle.version !== 1 ||
  !Array.isArray(bundle.workflows) ||
  !Array.isArray(bundle.models)
)
  fail("bundle format or version is unsupported");

const items = [];
if (!bundle.comfyui || !["pending", "fixed"].includes(bundle.comfyui.status))
  fail("comfyui is missing or has an invalid status");
const comfyuiFixed =
  fixedArtifact(bundle.comfyui, ["version", "sourceUrl", "licenseUrl"]) &&
  isHttpsUrl(bundle.comfyui.sourceUrl) &&
  isHttpsUrl(bundle.comfyui.licenseUrl);
items.push({ label: "comfyui", fixed: comfyuiFixed });

for (const operation of requiredOperations) {
  const workflow = bundle.workflows.find((item) => item?.operation === operation);
  if (!workflow || !["pending", "fixed"].includes(workflow.status))
    fail(`${operation} workflow is missing or has an invalid status`);
  items.push({
    label: `workflow:${operation}`,
    fixed:
      workflow.status === "fixed" &&
      typeof workflow.version === "string" &&
      Boolean(workflow.version.trim()) &&
      sha256Pattern.test(workflow.sha256 ?? ""),
  });
}

for (const role of requiredModelRoles) {
  const model = bundle.models.find((item) => item?.role === role);
  if (!model || !["pending", "fixed"].includes(model.status))
    fail(`${role} model is missing or has an invalid status`);
  items.push({
    label: `model:${role}`,
    fixed:
      fixedArtifact(model, ["name", "version", "sourceUrl", "licenseUrl"]) &&
      isHttpsUrl(model.sourceUrl) &&
      isHttpsUrl(model.licenseUrl),
  });
}

const hardware = readJson(hardwarePath, "Phase 5 hardware status");
const pilotHardware = hardware.profiles?.find(
  (item) => item?.profile === "vram_12gb",
);
const operationEvidence = new Set(
  pilotHardware?.evidence
    ?.filter(
      (item) =>
        item?.result === "passed" && sha256Pattern.test(item.outputSha256 ?? ""),
    )
    .map((item) => item.operation) ?? [],
);
const hardwareReady =
  pilotHardware?.status === "passed" &&
  requiredOperations.every((operation) => operationEvidence.has(operation)) &&
  sha256Pattern.test(pilotHardware?.export?.pdfSha256 ?? "") &&
  sha256Pattern.test(pilotHardware?.export?.salesPackageSha256 ?? "");

const fixedCount = items.filter((item) => item.fixed).length;
const pending = items.filter((item) => !item.fixed).map((item) => item.label);
console.log(
  `Desktop Adult pilot bundle: fixed=${fixedCount}, pending=${pending.length}, hardware12gb=${hardwareReady ? "passed" : "pending"}`,
);
if (pending.length) console.log(`Pending bundle items: ${pending.join(", ")}`);
if (strict && (pending.length || !hardwareReady)) process.exit(1);
