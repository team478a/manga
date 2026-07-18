import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(
  here,
  "../scripts/check-phase5-hardware-acceptance.mjs",
);
const canonical = path.resolve(
  here,
  "../../../docs/desktop/PHASE5_HARDWARE_ACCEPTANCE.json",
);
const evidence = (profile = "vram_8gb", dedicatedVramMb = 8192) => ({
  format: "mangai.phase5-hardware-evidence",
  version: 1,
  profile,
  hardware: {
    totalRamBytes: 32 * 1024 ** 3,
    gpuName: "Acceptance GPU",
    dedicatedVramMb,
  },
  checkedAt: "2026-07-18T00:00:00.000Z",
  projectIdSha256: "a".repeat(64),
  operations: [
    "text_to_image",
    "image_to_image",
    "controlnet",
    "inpainting",
  ].map((operation) => ({
    operation,
    result: "passed",
    outputSha256: "b".repeat(64),
    completedAt: "2026-07-18T00:00:00.000Z",
  })),
  export: {
    pdfSha256: "c".repeat(64),
    salesPackageSha256: "d".repeat(64),
    createdAt: "2026-07-18T00:00:00.000Z",
  },
});

test("Phase 5 hardware evidence import updates only its matching profile", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-phase5-hardware-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const status = path.join(root, "status.json");
  const evidenceFile = path.join(root, "evidence.json");
  fs.copyFileSync(canonical, status);
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence()));
  const env = { ...process.env, MANGAI_PHASE5_HARDWARE_STATUS_PATH: status };
  const output = execFileSync(process.execPath, [script, "--import", evidenceFile], {
    env,
    encoding: "utf8",
  });
  assert.match(output, /passed=1, pending=2, blocked=0/);
  const document = JSON.parse(fs.readFileSync(status, "utf8"));
  assert.equal(document.profiles[0].status, "passed");
  assert.equal(document.profiles[0].export.pdfSha256, "c".repeat(64));
  assert.equal(document.profiles[1].status, "pending");
  assert.throws(() =>
    execFileSync(process.execPath, [script, "--strict"], {
      env,
      stdio: "pipe",
    }),
  );
});

test("Phase 5 hardware evidence import rejects a mismatched VRAM profile", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-phase5-invalid-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const status = path.join(root, "status.json");
  const evidenceFile = path.join(root, "evidence.json");
  fs.copyFileSync(canonical, status);
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence("vram_12gb", 8192)));
  assert.throws(() =>
    execFileSync(process.execPath, [script, "--import", evidenceFile], {
      env: { ...process.env, MANGAI_PHASE5_HARDWARE_STATUS_PATH: status },
      stdio: "pipe",
    }),
  );
  const document = JSON.parse(fs.readFileSync(status, "utf8"));
  assert.equal(document.profiles[1].status, "pending");
});
