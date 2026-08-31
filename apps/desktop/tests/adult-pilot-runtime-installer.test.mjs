import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AdultPilotRuntimeInstaller,
  validateAdultPilotArchiveEntries,
} from "../dist-main/main/adult-pilot-runtime-installer.js";

const validEntries = [
  { path: "ComfyUI_windows_portable/", type: "directory" },
  { path: "ComfyUI_windows_portable/ComfyUI/", type: "directory" },
  { path: "ComfyUI_windows_portable/ComfyUI/main.py", type: "file" },
];

test("Adult Pilot Runtime archive rejects traversal, links and Windows path collisions", () => {
  for (const entry of [
    { path: "../escape", type: "file" },
    { path: "C:/escape", type: "file" },
    { path: "ComfyUI_windows_portable/link", type: "symlink" },
  ]) assert.throws(() => validateAdultPilotArchiveEntries([entry]));
  assert.throws(() => validateAdultPilotArchiveEntries([
    { path: "ComfyUI_windows_portable/A", type: "file" },
    { path: "ComfyUI_windows_portable/a", type: "file" },
  ]), /重複/);
});

test("Adult Pilot Runtime installs through isolated staging without overwriting", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-runtime-install-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const installer = new AdultPilotRuntimeInstaller();
  const result = await installer.install(root, validEntries, async (staging) => {
    const extracted = path.join(staging, "ComfyUI_windows_portable", "ComfyUI");
    fs.mkdirSync(extracted, { recursive: true });
    fs.writeFileSync(path.join(extracted, "main.py"), "print('verified')");
  });
  assert.equal(result.entryCount, 3);
  assert.equal(fs.readFileSync(path.join(result.runtimePath, "ComfyUI", "main.py"), "utf8"), "print('verified')");
  await assert.rejects(installer.install(root, validEntries, async () => {}), /上書き/);
});

test("Adult Pilot Runtime removes staging after an extraction failure", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-runtime-fail-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const installer = new AdultPilotRuntimeInstaller();
  await assert.rejects(installer.install(root, validEntries, async (staging) => {
    fs.writeFileSync(path.join(staging, "unexpected.txt"), "unsafe");
  }), /root directory/);
  assert.equal(fs.existsSync(path.join(root, "runtime", ".installing")), false);
});

test("Adult Pilot Runtime rejects extracted entries missing from the inspected list", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-runtime-extra-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const installer = new AdultPilotRuntimeInstaller();
  await assert.rejects(installer.install(root, validEntries, async (staging) => {
    const extracted = path.join(staging, "ComfyUI_windows_portable", "ComfyUI");
    fs.mkdirSync(extracted, { recursive: true });
    fs.writeFileSync(path.join(extracted, "main.py"), "ok");
    fs.writeFileSync(path.join(extracted, "unexpected.py"), "unsafe");
  }), /一覧外/);
});
