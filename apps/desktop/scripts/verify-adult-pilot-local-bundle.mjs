import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = path.resolve(
  process.env.MANGAI_ADULT_PILOT_BUNDLE_PATH ??
    path.join(repositoryRoot, "docs", "desktop", "DESKTOP_ADULT_PILOT_BUNDLE.json"),
);
const localRootInput = process.env.MANGAI_ADULT_PILOT_LOCAL_ROOT;
const strict = process.argv.includes("--strict");
const evidenceIndex = process.argv.indexOf("--evidence-out");
const evidenceOutput = evidenceIndex >= 0 ? process.argv[evidenceIndex + 1] : undefined;

const fail = (message) => {
  console.error(`Desktop Adult pilot local bundle invalid: ${message}`);
  process.exit(1);
};

if (!localRootInput) fail("MANGAI_ADULT_PILOT_LOCAL_ROOT is required");
if (!path.isAbsolute(localRootInput) || path.parse(localRootInput).root.startsWith("\\\\"))
  fail("local root must be an absolute path on a local drive");

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch {
  fail("bundle manifest could not be read");
}
if (manifest.format !== "mangai.desktop-adult-pilot-bundle" || manifest.version !== 1)
  fail("bundle manifest format is unsupported");

const localRoot = path.resolve(localRootInput);
if (!fs.statSync(localRoot, { throwIfNoEntry: false })?.isDirectory())
  fail("local root does not exist");
const realRoot = fs.realpathSync(localRoot);
const sha256Pattern = /^[0-9a-f]{64}$/;
const artifacts = [
  {
    id: "runtime",
    relativePath: path.join("runtime", "ComfyUI_windows_portable_nvidia.7z"),
    bytes: manifest.comfyui?.installedBytes,
    sha256: manifest.comfyui?.sha256,
  },
  ...(manifest.models ?? []).map((model) => ({
    id: model.role,
    relativePath: path.join(
      "models",
      model.role === "checkpoint" ? "checkpoints" : model.role,
      String(model.name ?? "").split(":").at(-1) ?? "",
    ),
    bytes: model.installedBytes,
    sha256: model.sha256,
  })),
];
if (
  artifacts.length !== 4 ||
  !["runtime", "checkpoint", "vae", "controlnet"].every((id) =>
    artifacts.some((artifact) => artifact.id === id),
  ) ||
  artifacts.some(
    (artifact) =>
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes <= 0 ||
      !sha256Pattern.test(artifact.sha256 ?? ""),
  )
)
  fail("bundle manifest artifact contract is incomplete");

const hashFile = async (file) => {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
};

const results = [];
for (const artifact of artifacts) {
  const candidate = path.resolve(realRoot, artifact.relativePath);
  if (!candidate.startsWith(`${realRoot}${path.sep}`)) fail(`${artifact.id} path escapes local root`);
  const stats = fs.statSync(candidate, { throwIfNoEntry: false });
  if (!stats?.isFile()) {
    results.push({ id: artifact.id, status: "missing" });
    continue;
  }
  const realFile = fs.realpathSync(candidate);
  if (!realFile.startsWith(`${realRoot}${path.sep}`)) fail(`${artifact.id} resolves outside local root`);
  if (stats.size !== artifact.bytes) {
    results.push({ id: artifact.id, status: "size_mismatch" });
    continue;
  }
  results.push({
    id: artifact.id,
    status: (await hashFile(realFile)) === artifact.sha256 ? "verified" : "sha256_mismatch",
  });
}

for (const result of results) console.log(`${result.id}: ${result.status}`);
const verified = results.filter((result) => result.status === "verified").length;
console.log(`Desktop Adult pilot local bundle: verified=${verified}, pending=${results.length - verified}`);
if (evidenceIndex >= 0) {
  if (!evidenceOutput) fail("--evidence-out requires an absolute JSON path");
  if (!path.isAbsolute(evidenceOutput)) fail("evidence output must be an absolute path");
  if (verified !== results.length) fail("evidence cannot be written for an incomplete bundle");
  const manifestSha256 = crypto
    .createHash("sha256")
    .update(fs.readFileSync(manifestPath))
    .digest("hex");
  const evidence = {
    format: "mangai.desktop-adult-pilot-bundle-evidence",
    version: 1,
    checkedAt: new Date().toISOString(),
    manifestSha256,
    artifacts: artifacts.map(({ id, bytes, sha256 }) => ({ id, bytes, sha256 })),
  };
  fs.writeFileSync(path.resolve(evidenceOutput), `${JSON.stringify(evidence, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  console.log("Desktop Adult pilot bundle evidence written");
}
if (strict && verified !== results.length) process.exit(1);
