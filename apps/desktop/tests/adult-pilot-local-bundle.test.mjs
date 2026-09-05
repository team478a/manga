import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(here, "../scripts/verify-adult-pilot-local-bundle.mjs");
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

const fixture = (root) => {
  const files = {
    runtime: ["runtime/ComfyUI_windows_portable_nvidia.7z", Buffer.from("runtime")],
    checkpoint: ["models/checkpoints/checkpoint.safetensors", Buffer.from("checkpoint")],
    vae: ["models/vae/vae.safetensors", Buffer.from("vae")],
    controlnet: ["models/controlnet/controlnet.safetensors", Buffer.from("controlnet")],
  };
  for (const [relative, bytes] of Object.values(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  const model = (role) => ({
    role,
    name: `test/${role}:${path.basename(files[role][0])}`,
    installedBytes: files[role][1].length,
    sha256: digest(files[role][1]),
  });
  const manifest = {
    format: "mangai.desktop-adult-pilot-bundle",
    version: 1,
    comfyui: { installedBytes: files.runtime[1].length, sha256: digest(files.runtime[1]) },
    models: [model("checkpoint"), model("vae"), model("controlnet")],
  };
  const manifestPath = path.join(root, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  return { files, manifestPath };
};

const run = (root, manifestPath, strict = true) =>
  execFileSync(process.execPath, [script, ...(strict ? ["--strict"] : [])], {
    env: {
      ...process.env,
      MANGAI_ADULT_PILOT_LOCAL_ROOT: root,
      MANGAI_ADULT_PILOT_BUNDLE_PATH: manifestPath,
    },
    encoding: "utf8",
  });

test("local Adult Pilot bundle verifies all four pinned artifacts", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-local-bundle-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { manifestPath } = fixture(root);
  const output = run(root, manifestPath);
  assert.match(output, /runtime: verified/);
  assert.match(output, /verified=4, pending=0/);
});

test("local Adult Pilot bundle reports missing and modified artifacts without deleting them", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-local-bundle-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { files, manifestPath } = fixture(root);
  fs.rmSync(path.join(root, files.vae[0]));
  fs.writeFileSync(path.join(root, files.controlnet[0]), Buffer.from("changed!!!"));
  const result = spawnSync(process.execPath, [script, "--strict"], {
    env: {
      ...process.env,
      MANGAI_ADULT_PILOT_LOCAL_ROOT: root,
      MANGAI_ADULT_PILOT_BUNDLE_PATH: manifestPath,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /vae: missing/);
  assert.match(result.stdout, /controlnet: sha256_mismatch/);
  assert.equal(fs.readFileSync(path.join(root, files.controlnet[0]), "utf8"), "changed!!!");
});

test("local Adult Pilot bundle requires an existing absolute local-drive root", () => {
  const result = spawnSync(process.execPath, [script], {
    env: { ...process.env, MANGAI_ADULT_PILOT_LOCAL_ROOT: "relative/path" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /absolute path on a local drive/);
});
