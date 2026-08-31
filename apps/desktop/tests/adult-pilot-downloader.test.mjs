import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AdultPilotDownloader } from "../dist-main/main/adult-pilot-downloader.js";

const fixture = (id, bytes) => ({
  id,
  fileName: `${id}.bin`,
  directory: id === "checkpoint" ? "checkpoints" : id,
  sourceUrl: `https://huggingface.co/mangai/${id}/resolve/fixed/${id}.bin`,
  bytes: bytes.length,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
});

test("Adult Pilot downloader accepts only the pinned GitHub runtime asset", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-adult-runtime-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from("verified-comfyui-runtime");
  const artifact = {
    id: "runtime",
    fileName: "ComfyUI_windows_portable_nvidia.7z",
    directory: "checkpoints",
    area: "runtime",
    sourceUrl: "https://github.com/Comfy-Org/ComfyUI/releases/download/v0.34.0/ComfyUI_windows_portable_nvidia.7z",
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
  const downloader = new AdultPilotDownloader({
    artifacts: [artifact],
    freeBytes: () => 100 * 1024 ** 3,
    fetcher: async () => new Response(bytes, { status: 200 }),
  });
  const result = await downloader.download(root, "runtime");
  assert.equal(result.filePath, path.join(fs.realpathSync(root), "runtime", artifact.fileName));
  assert.deepEqual(fs.readFileSync(result.filePath), bytes);
  const reused = await downloader.download(root, "runtime");
  assert.equal(reused.resumedFrom, bytes.length);
});

test("Adult Pilot downloader refuses to overwrite an invalid completed artifact", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-adult-invalid-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from("expected"), artifact = fixture("checkpoint", bytes);
  const directory = path.join(root, "models", "checkpoints");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "checkpoint.bin"), Buffer.from("tampered"));
  const downloader = new AdultPilotDownloader({
    artifacts: [artifact],
    freeBytes: () => 100 * 1024 ** 3,
    fetcher: async () => { throw new Error("must not fetch"); },
  });
  await assert.rejects(downloader.download(root, "checkpoint"), /既存artifact/);
});

test("Adult Pilot downloader resumes a partial official artifact and verifies SHA", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-adult-download-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from("verified-adult-pilot-artifact"), artifact = fixture("checkpoint", bytes);
  const partialDirectory = path.join(root, "models", "checkpoints");
  fs.mkdirSync(partialDirectory, { recursive: true });
  fs.writeFileSync(path.join(partialDirectory, "checkpoint.bin.partial"), bytes.subarray(0, 8));
  let range;
  const downloader = new AdultPilotDownloader({
    artifacts: [artifact],
    freeBytes: () => 100 * 1024 ** 3,
    fetcher: async (_url, init) => {
      range = init?.headers?.Range;
      return new Response(bytes.subarray(8), { status: 206 });
    },
  });
  const result = await downloader.download(root, "checkpoint");
  assert.equal(range, "bytes=8-");
  assert.equal(result.resumedFrom, 8);
  assert.deepEqual(fs.readFileSync(result.filePath), bytes);
});

test("Adult Pilot downloader rejects unsafe redirects, low disk and bad hashes", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-adult-download-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from("fixed"), artifact = fixture("vae", bytes);
  await assert.rejects(
    new AdultPilotDownloader({ artifacts: [artifact], freeBytes: () => 0 }).download(root, "vae"),
    /空き容量/,
  );
  await assert.rejects(
    new AdultPilotDownloader({
      artifacts: [artifact],
      freeBytes: () => 100 * 1024 ** 3,
      fetcher: async () => new Response(null, { status: 302, headers: { location: "http://evil.example/file" } }),
    }).download(root, "vae"),
    /公式HTTPS/,
  );
  await assert.rejects(
    new AdultPilotDownloader({
      artifacts: [artifact],
      freeBytes: () => 100 * 1024 ** 3,
      fetcher: async () => new Response(Buffer.from("wrong"), { status: 200 }),
    }).download(root, "vae"),
    /SHA-256/,
  );
  assert.equal(fs.existsSync(path.join(root, "models", "vae", "vae.bin")), false);
});
