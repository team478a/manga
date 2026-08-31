import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AdultPilot7ZipAdapter,
  findSupported7Zip,
  parse7ZipTechnicalList,
  parse7ZipVersion,
} from "../dist-main/main/adult-pilot-7zip.js";

test("Adult Pilot accepts only 7-Zip 25.01 or newer", () => {
  assert.equal(parse7ZipVersion("7-Zip 26.02 (x64)"), "26.02");
  assert.throws(() => parse7ZipVersion("7-Zip 24.09 (x64)"), /25.01/);
  assert.throws(() => parse7ZipVersion("unknown"), /version/);
});

test("Adult Pilot parses 7-Zip technical entries including links", () => {
  const entries = parse7ZipTechnicalList([
    "Path = ComfyUI_windows_portable",
    "Folder = +",
    "Attributes = D",
    "",
    "Path = ComfyUI_windows_portable/ComfyUI/main.py",
    "Folder = -",
    "Attributes = A",
    "",
    "Path = ComfyUI_windows_portable/link",
    "Symbolic Link = ../outside",
  ].join("\n"));
  assert.deepEqual(entries.map(({ type }) => type), ["directory", "file", "symlink"]);
});

test("Adult Pilot detects only a fixed installed 7-Zip path", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-7zip-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "7-Zip");
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "7z.exe"), "fixture");
  assert.equal(findSupported7Zip({ ProgramW6432: root }), path.join(directory, "7z.exe"));
  assert.equal(findSupported7Zip({ PATH: directory }), null);
});

test("Adult Pilot 7-Zip adapter uses literal arguments and refuses a dirty staging area", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-7zip-adapter-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const executable = path.join(root, "7z.exe"), archive = path.join(root, "runtime.7z");
  const staging = path.join(root, "staging");
  fs.writeFileSync(executable, "fixture");
  fs.writeFileSync(archive, "fixture");
  fs.mkdirSync(staging);
  const calls = [];
  const adapter = new AdultPilot7ZipAdapter(executable, async (_file, args) => {
    calls.push(args);
    if (args[0] === "i") return { stdout: "7-Zip 26.02 (x64)", stderr: "" };
    return { stdout: "Path = ComfyUI_windows_portable\nFolder = +\nAttributes = D", stderr: "" };
  });
  assert.equal((await adapter.list(archive))[0].type, "directory");
  assert.deepEqual(calls[1], ["l", "-slt", "-ba", "--", archive]);
  fs.writeFileSync(path.join(staging, "occupied"), "fixture");
  await assert.rejects(adapter.extract(archive, staging), /空/);
});
