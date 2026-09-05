import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repositoryRoot = path.resolve(process.env.MANGAI_ADULT_PILOT_REPOSITORY_ROOT ?? defaultRoot);
const manifestPath = path.resolve(
  process.env.MANGAI_ADULT_PILOT_BUNDLE_PATH ??
    path.join(repositoryRoot, "docs", "desktop", "DESKTOP_ADULT_PILOT_BUNDLE.json"),
);
const evidencePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha256Pattern = /^[0-9a-f]{64}$/;
const requiredIds = ["runtime", "checkpoint", "vae", "controlnet"];
const requiredOperations = ["text_to_image", "image_to_image", "controlnet", "inpainting"];

const fail = (message) => {
  console.error(`Desktop Adult pilot bundle evidence invalid: ${message}`);
  process.exit(1);
};
const readJson = (file, label) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    fail(`${label} could not be read`);
  }
};
const sha256File = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

if (!evidencePath) fail("evidence JSON path is required");
let manifestBytes;
try {
  manifestBytes = fs.readFileSync(manifestPath);
} catch {
  fail("bundle manifest could not be read");
}
const manifest = readJson(manifestPath, "bundle manifest");
const evidence = readJson(evidencePath, "evidence");
const checkedAt = typeof evidence.checkedAt === "string" ? Date.parse(evidence.checkedAt) : NaN;
if (
  manifest.format !== "mangai.desktop-adult-pilot-bundle" ||
  manifest.version !== 1 ||
  evidence.format !== "mangai.desktop-adult-pilot-bundle-evidence" ||
  evidence.version !== 1 ||
  !Number.isFinite(checkedAt) ||
  new Date(checkedAt).toISOString() !== evidence.checkedAt ||
  !sha256Pattern.test(evidence.manifestSha256 ?? "") ||
  evidence.manifestSha256 !== crypto.createHash("sha256").update(manifestBytes).digest("hex") ||
  !Array.isArray(evidence.artifacts) ||
  !Array.isArray(manifest.models) ||
  !Array.isArray(manifest.workflows)
)
  fail("format, timestamp, or manifest fingerprint does not match");

const expectedArtifacts = [
  { id: "runtime", bytes: manifest.comfyui?.installedBytes, sha256: manifest.comfyui?.sha256 },
  ...(manifest.models ?? []).map((model) => ({
    id: model.role,
    bytes: model.installedBytes,
    sha256: model.sha256,
  })),
];
for (const id of requiredIds) {
  const expected = expectedArtifacts.find((item) => item.id === id);
  const actual = evidence.artifacts.find((item) => item?.id === id);
  if (
    !expected ||
    !actual ||
    actual.bytes !== expected.bytes ||
    actual.sha256 !== expected.sha256 ||
    !sha256Pattern.test(actual.sha256 ?? "")
  )
    fail(`${id} evidence does not match the fixed manifest`);
}
if (evidence.artifacts.length !== requiredIds.length)
  fail("evidence contains an unexpected artifact");

for (const operation of requiredOperations) {
  const workflow = manifest.workflows?.find((item) => item?.operation === operation);
  if (!workflow) fail(`${operation} workflow is missing`);
  const workflowFile = path.resolve(repositoryRoot, workflow.file ?? "");
  const mappingFile = path.resolve(repositoryRoot, workflow.mappingFile ?? "");
  if (
    !workflowFile.startsWith(`${repositoryRoot}${path.sep}`) ||
    !mappingFile.startsWith(`${repositoryRoot}${path.sep}`) ||
    !fs.existsSync(workflowFile) ||
    !fs.existsSync(mappingFile) ||
    sha256File(workflowFile) !== workflow.sha256 ||
    sha256File(mappingFile) !== workflow.mappingSha256
  )
    fail(`${operation} workflow files do not match the fixed manifest`);
}

Object.assign(manifest.comfyui, {
  status: "fixed",
  reviewStatus: "local_bundle_evidence_verified",
});
for (const model of manifest.models)
  Object.assign(model, { status: "fixed", reviewStatus: "local_bundle_evidence_verified" });
for (const workflow of manifest.workflows)
  Object.assign(workflow, { status: "fixed", reviewStatus: "repository_hash_verified" });
manifest.updatedAt = new Date().toISOString();

const temporary = path.join(
  path.dirname(manifestPath),
  `.${path.basename(manifestPath)}.${process.pid}.tmp`,
);
try {
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  fs.renameSync(temporary, manifestPath);
} finally {
  fs.rmSync(temporary, { force: true });
}
console.log("Desktop Adult pilot bundle evidence imported: fixed=8");
