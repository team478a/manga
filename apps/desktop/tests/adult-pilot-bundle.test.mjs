import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(here, "../scripts/check-adult-pilot-bundle.mjs");
const canonicalBundle = path.resolve(
  here,
  "../../../docs/desktop/DESKTOP_ADULT_PILOT_BUNDLE.json",
);
const hash = (value) => value.repeat(64);

test("canonical Adult pilot candidates are approved for internal use but remain runtime pending", () => {
  const bundle = JSON.parse(fs.readFileSync(canonicalBundle, "utf8"));
  assert.equal(bundle.distributionMode, "user_download_official_source");
  assert.equal(bundle.licenseReview.status, "owner_confirmed_for_internal_pilot");
  assert.equal(bundle.licenseReview.redistributionApproved, false);
  assert.equal(bundle.comfyui.version, "v0.34.0");
  assert.equal(bundle.comfyui.status, "pending");
  assert.deepEqual(
    bundle.models.map(({ role, status, version, sha256 }) => ({
      role,
      status,
      version,
      sha256,
    })),
    [
      {
        role: "checkpoint",
        status: "pending",
        version: "462165984030d82259a11f4367a4eed129e94a7b",
        sha256: "31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b",
      },
      {
        role: "vae",
        status: "pending",
        version: "207b116dae70ace3637169f1ddd2434b91b3a8cd",
        sha256: "235745af8d86bf4a4c1b5b4f529868b37019a10f7c0b2e79ad0abca3a22bc6e1",
      },
      {
        role: "controlnet",
        status: "pending",
        version: "eb115a19a10d14909256db740ed109532ab1483c",
        sha256: "ea99040544a999f814fd854575a3aee069a005d026864c8d321b82576706a221",
      },
    ],
  );
});

const run = (bundlePath, hardwarePath, strict = false) =>
  execFileSync(process.execPath, [script, ...(strict ? ["--strict"] : [])], {
    env: {
      ...process.env,
      MANGAI_ADULT_PILOT_BUNDLE_PATH: bundlePath,
      MANGAI_PHASE5_HARDWARE_STATUS_PATH: hardwarePath,
    },
    encoding: "utf8",
  });

test("canonical Adult pilot bundle remains fail-closed while artifacts are pending", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-adult-pilot-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const hardwarePath = path.join(root, "hardware.json");
  fs.writeFileSync(hardwarePath, JSON.stringify({ profiles: [] }));
  assert.match(run(canonicalBundle, hardwarePath), /fixed=0, pending=8/);
  assert.throws(() => run(canonicalBundle, hardwarePath, true));
});

test("strict Adult pilot bundle requires fixed artifacts and 12GB evidence", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-adult-pilot-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bundlePath = path.join(root, "bundle.json");
  const hardwarePath = path.join(root, "hardware.json");
  const bundle = JSON.parse(fs.readFileSync(canonicalBundle, "utf8"));
  Object.assign(bundle.comfyui, {
    status: "fixed",
    version: "1.0.0",
    sourceUrl: "https://example.test/comfyui",
    licenseUrl: "https://example.test/comfyui/license",
    sha256: hash("a"),
    installedBytes: 1,
  });
  for (const workflow of bundle.workflows)
    Object.assign(workflow, { status: "fixed", version: "pilot-v1" });
  for (const model of bundle.models)
    Object.assign(model, {
      status: "fixed",
      name: `${model.role}-pilot`,
      version: "1",
      sourceUrl: `https://example.test/${model.role}`,
      licenseUrl: `https://example.test/${model.role}/license`,
      sha256: hash("c"),
      installedBytes: 1,
    });
  fs.writeFileSync(bundlePath, JSON.stringify(bundle));
  fs.writeFileSync(
    hardwarePath,
    JSON.stringify({
      profiles: [
        {
          profile: "vram_12gb",
          status: "passed",
          evidence: [
            "text_to_image",
            "image_to_image",
            "controlnet",
            "inpainting",
          ].map((operation) => ({ operation, result: "passed", outputSha256: hash("d") })),
          export: { pdfSha256: hash("e"), salesPackageSha256: hash("f") },
        },
      ],
    }),
  );
  assert.match(run(bundlePath, hardwarePath, true), /fixed=8, pending=0, hardware12gb=passed/);
});
