import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configureAdultPilotRuntime } from "../dist-main/main/adult-pilot-runtime-config.js";

const fixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-runtime-config-"));
  const runtime = path.join(root, "ComfyUI_windows_portable");
  fs.mkdirSync(path.join(runtime, "ComfyUI"), { recursive: true });
  fs.mkdirSync(path.join(runtime, "python_embeded"));
  fs.writeFileSync(path.join(runtime, "ComfyUI", "main.py"), "fixture");
  fs.writeFileSync(path.join(runtime, "python_embeded", "python.exe"), "fixture");
  fs.writeFileSync(path.join(runtime, "run_nvidia_gpu.bat"), "fixture");
  const models = path.join(root, "models");
  for (const directory of ["checkpoints", "vae", "controlnet"])
    fs.mkdirSync(path.join(models, directory), { recursive: true });
  return { root, runtime, models };
};

test("Adult Pilot config points ComfyUI at one verified model root", (t) => {
  const value = fixture();
  t.after(() => fs.rmSync(value.root, { recursive: true, force: true }));
  const result = configureAdultPilotRuntime(value.runtime, value.models);
  const contents = fs.readFileSync(result.configPath, "utf8");
  assert.match(contents, /mangai_adult_pilot:/);
  assert.match(contents, /checkpoints: checkpoints/);
  assert.match(contents, /vae: vae/);
  assert.match(contents, /controlnet: controlnet/);
  assert.match(contents, new RegExp(result.modelRoot.replaceAll("\\", "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.throws(() => configureAdultPilotRuntime(value.runtime, value.models), /上書き/);
});

test("Adult Pilot config fails closed on incomplete runtime or model directories", (t) => {
  const value = fixture();
  t.after(() => fs.rmSync(value.root, { recursive: true, force: true }));
  fs.rmSync(path.join(value.runtime, "run_nvidia_gpu.bat"));
  assert.throws(() => configureAdultPilotRuntime(value.runtime, value.models), /必須file/);
  fs.writeFileSync(path.join(value.runtime, "run_nvidia_gpu.bat"), "fixture");
  fs.rmdirSync(path.join(value.models, "controlnet"));
  assert.throws(() => configureAdultPilotRuntime(value.runtime, value.models), /controlnet/);
});
