import fs from "node:fs";
import path from "node:path";
import {
  recommendRuntimeProfile,
  runtimeLimits,
  runtimeProfileSelectionSchema,
  type RuntimeHardware,
  type RuntimeProfileSelection,
  type RuntimeProfileState,
} from "@mangai/ai-core";

type ElectronGpuDevice = {
  active?: boolean;
  deviceString?: string;
  driverVendor?: string;
  videoMemory?: number;
};

export function hardwareFromElectronGpuInfo(
  totalRamBytes: number,
  gpuInfo: unknown,
): RuntimeHardware {
  const devices =
    gpuInfo && typeof gpuInfo === "object" && "gpuDevice" in gpuInfo
      ? (gpuInfo as { gpuDevice?: ElectronGpuDevice[] }).gpuDevice
      : undefined;
  const candidates = (devices ?? []).filter((device) => {
    const name = device.deviceString?.toLowerCase() ?? "";
    return !name.includes("microsoft basic render") && !name.includes("swiftshader");
  });
  const selected = [...candidates].sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1;
    return (right.videoMemory ?? 0) - (left.videoMemory ?? 0);
  })[0];
  return {
    totalRamBytes,
    gpuName: selected?.deviceString?.trim() || null,
    dedicatedVramMb:
      typeof selected?.videoMemory === "number" && selected.videoMemory > 0
        ? selected.videoMemory
        : null,
  };
}

export class RuntimeProfileService {
  private selection: RuntimeProfileSelection = "auto";
  private readonly detectedAt = new Date().toISOString();

  constructor(
    private readonly filePath: string,
    private readonly hardware: RuntimeHardware,
  ) {
    try {
      const value = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
        selection?: unknown;
      };
      this.selection = runtimeProfileSelectionSchema.parse(value.selection);
    } catch {
      this.selection = "auto";
    }
  }

  getState(): RuntimeProfileState {
    const recommendedProfile = recommendRuntimeProfile(this.hardware);
    const effectiveProfile =
      this.selection === "auto" ? recommendedProfile : this.selection;
    return {
      hardware: this.hardware,
      recommendedProfile,
      selection: this.selection,
      effectiveProfile,
      limits: runtimeLimits(effectiveProfile),
      detectedAt: this.detectedAt,
    };
  }

  saveSelection(value: unknown): RuntimeProfileState {
    this.selection = runtimeProfileSelectionSchema.parse(value);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(
      this.filePath,
      JSON.stringify({ selection: this.selection }, null, 2),
      { encoding: "utf8", mode: 0o600 },
    );
    return this.getState();
  }
}
