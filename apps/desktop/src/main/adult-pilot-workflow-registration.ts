import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { workflowMappingSchema } from "@mangai/ai-core";

const definitions = [
  ["MANGAI Adult Pilot: Text to Image", "text-to-image"],
  ["MANGAI Adult Pilot: Image to Image", "image-to-image"],
  ["MANGAI Adult Pilot: ControlNet", "controlnet"],
  ["MANGAI Adult Pilot: Inpainting", "inpainting"],
] as const;

type ExistingWorkflow = { name?: unknown; filePath?: unknown; mappingJson?: unknown };

const digest = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const normalizedJson = (value: unknown) => JSON.stringify(value);

export const registerAdultPilotWorkflows = (
  workflowDirectory: string,
  existing: unknown[],
  register: (name: string, workflowPath: string, mapping: unknown) => void,
) => {
  if (!path.isAbsolute(workflowDirectory)) throw new Error("Adult Pilot workflow保存先を確認できません。");
  const planned = definitions.map(([name, basename]) => {
    const workflowPath = path.join(workflowDirectory, `${basename}.json`),
      mappingPath = path.join(workflowDirectory, `${basename}.mapping.json`);
    if (!fs.statSync(workflowPath, { throwIfNoEntry: false })?.isFile() || !fs.statSync(mappingPath, { throwIfNoEntry: false })?.isFile())
      throw new Error(`Adult Pilot workflowを確認できません: ${basename}`);
    const workflowRaw = fs.readFileSync(workflowPath),
      mapping = workflowMappingSchema.parse(JSON.parse(fs.readFileSync(mappingPath, "utf8"))),
      current = existing
        .filter((item): item is ExistingWorkflow => typeof item === "object" && item !== null)
        .find((item) => item.name === name);
    if (current) {
      if (typeof current.filePath !== "string" || typeof current.mappingJson !== "string")
        throw new Error(`同名のAdult Pilot workflow設定を確認できません: ${name}`);
      const currentMapping = workflowMappingSchema.parse(JSON.parse(current.mappingJson));
      if (!fs.statSync(current.filePath, { throwIfNoEntry: false })?.isFile() || digest(fs.readFileSync(current.filePath)) !== digest(workflowRaw) || normalizedJson(currentMapping) !== normalizedJson(mapping))
        throw new Error(`同名のAdult Pilot workflowが固定内容と一致しません: ${name}`);
    }
    return { name, workflowPath, mapping, current: Boolean(current) };
  });
  for (const item of planned) if (!item.current) register(item.name, item.workflowPath, item.mapping);
  return { status: "registered" as const, registeredCount: planned.filter((item) => !item.current).length, totalCount: planned.length };
};
