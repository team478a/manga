import fs from "node:fs";
import path from "node:path";

const workflows = [
  ["text_to_image", "text-to-image.json"],
  ["image_to_image", "image-to-image.json"],
  ["controlnet", "controlnet.json"],
  ["inpainting", "inpainting.json"],
] as const;
const requiredModels = ["sd_xl_base_1.0.safetensors", "sdxl.vae.safetensors", "diffusion_pytorch_model.safetensors"];

export type AdultPilotRuntimeAcceptanceReport = {
  status: "passed" | "failed";
  comfyuiVersion: string | null;
  gpuVramBytes: number | null;
  modelsAvailable: boolean;
  workflows: Array<{ operation: string; status: "passed" | "failed"; missingNodes: string[] }>;
};

export const inspectAdultPilotRuntime = async (
  workflowDirectory: string,
  fetchRuntime: typeof fetch = fetch,
): Promise<AdultPilotRuntimeAcceptanceReport> => {
  if (!path.isAbsolute(workflowDirectory)) throw new Error("workflow保存先を確認できません。");
  const definitions = workflows.map(([operation, file]) => {
    const target = path.join(workflowDirectory, file);
    if (!fs.statSync(target, { throwIfNoEntry: false })?.isFile())
      throw new Error(`Adult Pilot workflowを確認できません: ${file}`);
    return { operation, workflow: JSON.parse(fs.readFileSync(target, "utf8")) as Record<string, { class_type?: unknown }> };
  });
  const request = async (pathname: string) => {
    const response = await fetchRuntime(`http://127.0.0.1:8188${pathname}`, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error("ComfyUI Runtime診断を取得できませんでした。");
    return response.json() as Promise<Record<string, any>>;
  };
  const [stats, objectInfo] = await Promise.all([request("/system_stats"), request("/object_info")]),
    comfyuiVersion = typeof stats.system?.comfyui_version === "string" ? stats.system.comfyui_version : null,
    gpuVramBytes = Math.max(0, ...(Array.isArray(stats.devices) ? stats.devices : []).filter((device: any) => String(device.type ?? "").toLowerCase() !== "cpu").map((device: any) => Number(device.vram_total) || 0)) || null,
    modelChoices = [
      objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0],
      objectInfo.VAELoader?.input?.required?.vae_name?.[0],
      objectInfo.ControlNetLoader?.input?.required?.control_net_name?.[0],
    ].flat(Infinity).filter((value): value is string => typeof value === "string"),
    modelsAvailable = requiredModels.every((model) => modelChoices.includes(model)),
    workflowReports = definitions.map(({ operation, workflow }) => {
      const requiredNodes = [...new Set(Object.values(workflow).map((node) => node.class_type).filter((value): value is string => typeof value === "string"))],
        missingNodes = requiredNodes.filter((node) => !Object.hasOwn(objectInfo, node));
      return { operation, status: missingNodes.length === 0 ? "passed" as const : "failed" as const, missingNodes };
    }),
    passed = comfyuiVersion === "0.34.0" && (gpuVramBytes ?? 0) >= 12 * 1024 ** 3 && modelsAvailable && workflowReports.every((workflow) => workflow.status === "passed");
  return { status: passed ? "passed" : "failed", comfyuiVersion, gpuVramBytes, modelsAvailable, workflows: workflowReports };
};
