import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { inspectAdultPilotRuntime } from "../dist-main/main/adult-pilot-runtime-acceptance.js";

const workflowDirectory = path.resolve(import.meta.dirname, "..", "resources", "adult-pilot-workflows");
const objectInfo = () => {
  const result = {};
  for (const file of ["text-to-image.json", "image-to-image.json", "controlnet.json", "inpainting.json"])
    for (const node of Object.values(JSON.parse(fs.readFileSync(path.join(workflowDirectory, file), "utf8"))))
      result[node.class_type] = { input: {} };
  result.CheckpointLoaderSimple.input = { required: { ckpt_name: [["sd_xl_base_1.0.safetensors"]] } };
  result.VAELoader.input = { required: { vae_name: [["sdxl.vae.safetensors"]] } };
  result.ControlNetLoader.input = { required: { control_net_name: [["diffusion_pytorch_model.safetensors"]] } };
  return result;
};
const response = (body) => ({ ok: true, json: async () => body });

test("Adult Pilot runtime acceptance passes four workflows without generation", async () => {
  const requested = [], report = await inspectAdultPilotRuntime(workflowDirectory, async (url) => {
    requested.push(url);
    return response(url.endsWith("/system_stats") ? { system: { comfyui_version: "0.34.0" }, devices: [{ type: "cuda", vram_total: 12 * 1024 ** 3 }] } : objectInfo());
  });
  assert.equal(report.status, "passed");
  assert.equal(report.workflows.length, 4);
  assert.deepEqual(requested.sort(), ["http://127.0.0.1:8188/object_info", "http://127.0.0.1:8188/system_stats"]);
});

test("Adult Pilot runtime acceptance fails closed on version, VRAM, model or node mismatch", async () => {
  const nodes = objectInfo(); delete nodes.VAEDecodeTiled;
  const report = await inspectAdultPilotRuntime(workflowDirectory, async (url) => response(url.endsWith("/system_stats") ? { system: { comfyui_version: "0.33.0" }, devices: [{ type: "cuda", vram_total: 8 * 1024 ** 3 }] } : nodes));
  assert.equal(report.status, "failed");
  assert.ok(report.workflows.some((workflow) => workflow.missingNodes.includes("VAEDecodeTiled")));
});

test("Adult Pilot workflows are packaged and the diagnostic is connected without prompt submission", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "..", "package.json"), "utf8")),
    main = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "main", "index.ts"), "utf8"),
    preload = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "preload", "index.ts"), "utf8");
  assert.ok(packageJson.build.extraResources.some((entry) => entry.to === "adult-pilot-workflows"));
  assert.match(main, /ai:adult-pilot:inspect-runtime/);
  assert.match(preload, /inspectAdultPilotRuntime/);
  assert.doesNotMatch(main, /adult-pilot:inspect-runtime[\s\S]{0,800}\/prompt/);
});
