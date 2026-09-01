import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertAdultPilotWorkflowSelection, registerAdultPilotWorkflows } from "../dist-main/main/adult-pilot-workflow-registration.js";

const source = path.resolve(import.meta.dirname, "..", "resources", "adult-pilot-workflows");

test("registers all four fixed Adult Pilot workflows without generating", () => {
  const registered = [], result = registerAdultPilotWorkflows(source, [], (name, workflowPath, mapping) => registered.push({ name, workflowPath, mapping }));
  assert.deepEqual(result, { status: "registered", registeredCount: 4, totalCount: 4 });
  assert.equal(registered.length, 4);
  assert.ok(registered.every((item) => item.workflowPath.startsWith(source + path.sep)));
});

test("reuses exact workflows and fails closed before partial registration on a conflict", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-adult-pilot-workflow-"));
  try {
    const existing = [
      { name: "MANGAI Adult Pilot: Text to Image", filePath: path.join(source, "text-to-image.json"), mappingJson: fs.readFileSync(path.join(source, "text-to-image.mapping.json"), "utf8") },
      { name: "MANGAI Adult Pilot: ControlNet", filePath: path.join(root, "changed.json"), mappingJson: fs.readFileSync(path.join(source, "controlnet.mapping.json"), "utf8") },
    ];
    fs.writeFileSync(existing[1].filePath, "{}");
    const registered = [];
    assert.throws(() => registerAdultPilotWorkflows(source, existing, (...args) => registered.push(args)), /固定内容と一致しません/);
    assert.equal(registered.length, 0);
    const exact = [
      ["MANGAI Adult Pilot: Text to Image", "text-to-image"],
      ["MANGAI Adult Pilot: Image to Image", "image-to-image"],
      ["MANGAI Adult Pilot: ControlNet", "controlnet"],
      ["MANGAI Adult Pilot: Inpainting", "inpainting"],
    ].map(([name, basename]) => ({ name, filePath: path.join(source, `${basename}.json`), mappingJson: fs.readFileSync(path.join(source, `${basename}.mapping.json`), "utf8") }));
    assert.deepEqual(registerAdultPilotWorkflows(source, exact, () => assert.fail("must reuse")), { status: "registered", registeredCount: 0, totalCount: 4 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("one-image preflight accepts only the fixed workflow for its operation", () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(source, "text-to-image.json"), "utf8"));
  const mapping = JSON.parse(fs.readFileSync(path.join(source, "text-to-image.mapping.json"), "utf8"));
  assert.doesNotThrow(() => assertAdultPilotWorkflowSelection(source, "text_to_image", { workflow, mapping }));
  assert.throws(() => assertAdultPilotWorkflowSelection(source, "inpainting", { workflow, mapping }), /一致しません/);
});
