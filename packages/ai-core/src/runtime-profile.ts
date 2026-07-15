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
  maxControlNets: number;
  maxLoras: number;
  exclusiveGpuWork: boolean;
  unloadTextModelBeforeImage: boolean;
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
    cpu_only: 512,
    vram_6gb: 768,
    vram_8gb: 1024,
    vram_12gb: 1024,
    vram_16gb: 1536,
    vram_24gb_plus: 2048,
    remote_render: 4096,
  };
  const maxControlNets: Record<RuntimeProfileId, number> = {
    cpu_only: 0,
    vram_6gb: 0,
    vram_8gb: 1,
    vram_12gb: 2,
    vram_16gb: 4,
    vram_24gb_plus: 8,
    remote_render: 8,
  };
  const maxLoras: Record<RuntimeProfileId, number> = {
    cpu_only: 0,
    vram_6gb: 1,
    vram_8gb: 2,
    vram_12gb: 3,
    vram_16gb: 4,
    vram_24gb_plus: 8,
    remote_render: 8,
  };
  return {
    batchSize: 1,
    maxConcurrentLocalJobs: 1,
    maxOutputDimension: maxOutputDimension[profile],
    maxControlNets: maxControlNets[profile],
    maxLoras: maxLoras[profile],
    exclusiveGpuWork: [
      "cpu_only",
      "vram_6gb",
      "vram_8gb",
      "vram_12gb",
    ].includes(profile),
    unloadTextModelBeforeImage: [
      "cpu_only",
      "vram_6gb",
      "vram_8gb",
      "vram_12gb",
    ].includes(profile),
    localImageGenerationRecommended: profile !== "cpu_only",
  };
}

export function constrainImageDimensions(
  width: number | undefined,
  height: number | undefined,
  maxDimension: number | null,
): { width?: number; height?: number; adjusted: boolean } {
  if (!maxDimension || (!width && !height))
    return { width, height, adjusted: false };
  const largest = Math.max(width ?? 0, height ?? 0);
  if (largest <= maxDimension)
    return { width, height, adjusted: false };
  const scale = maxDimension / largest;
  const fit = (value: number | undefined) =>
    value === undefined
      ? undefined
      : Math.max(64, Math.floor((value * scale) / 8) * 8);
  return {
    width: fit(width),
    height: fit(height),
    adjusted: true,
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
