import { z } from "zod";

export const runtimeProfileIdSchema = z.enum([
  "cpu_only",
  "vram_6gb",
  "vram_8gb",
  "vram_12gb",
  "vram_16gb",
  "vram_24gb_plus",
  "remote_render",
]);
export type RuntimeProfileId = z.infer<typeof runtimeProfileIdSchema>;
export const runtimeProfileSelectionSchema = z.union([
  z.literal("auto"),
  runtimeProfileIdSchema,
]);
export type RuntimeProfileSelection = z.infer<
  typeof runtimeProfileSelectionSchema
>;

export type RuntimeHardware = {
  totalRamBytes: number;
  gpuName: string | null;
  dedicatedVramMb: number | null;
};

export type RuntimeLimits = {
  batchSize: 1;
  maxConcurrentLocalJobs: 1;
  maxOutputDimension: number | null;
  localImageGenerationRecommended: boolean;
};

export function recommendRuntimeProfile(
  hardware: RuntimeHardware,
): RuntimeProfileId {
  const vram = hardware.dedicatedVramMb;
  if (!hardware.gpuName && !vram) return "cpu_only";
  // Electron may detect a GPU without exposing its dedicated memory. Use the
  // smallest GPU profile so an unknown value never enables expensive defaults.
  if (!vram || vram < 8 * 1024) return "vram_6gb";
  if (vram < 12 * 1024) return "vram_8gb";
  if (vram < 16 * 1024) return "vram_12gb";
  if (vram < 24 * 1024) return "vram_16gb";
  return "vram_24gb_plus";
}

export function runtimeLimits(profile: RuntimeProfileId): RuntimeLimits {
  const maxOutputDimension: Record<RuntimeProfileId, number | null> = {
    cpu_only: null,
    vram_6gb: 768,
    vram_8gb: 1024,
    vram_12gb: 1024,
    vram_16gb: 1536,
    vram_24gb_plus: 2048,
    remote_render: 4096,
  };
  return {
    batchSize: 1,
    maxConcurrentLocalJobs: 1,
    maxOutputDimension: maxOutputDimension[profile],
    localImageGenerationRecommended: profile !== "cpu_only",
  };
}

export type RuntimeProfileState = {
  hardware: RuntimeHardware;
  recommendedProfile: RuntimeProfileId;
  selection: RuntimeProfileSelection;
  effectiveProfile: RuntimeProfileId;
  limits: RuntimeLimits;
  detectedAt: string;
};
