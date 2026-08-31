import type { RuntimeProfileState } from "./runtime-profile.js";
import { z } from "zod";

export const ADULT_PILOT_MINIMUM_VRAM_MB = 12 * 1024;
export const ADULT_PILOT_MODEL_BYTES = 12_276_887_360;

export type AdultLocalAISetupConsent = {
  licenseTerms: boolean;
  localOnly: boolean;
  adultSafety: boolean;
};
export const adultLocalAISetupConsentSchema = z.object({
  licenseTerms: z.literal(true),
  localOnly: z.literal(true),
  adultSafety: z.literal(true),
});

export type AdultLocalAISetupReadiness = {
  deviceEligible: boolean;
  consentComplete: boolean;
  acquisitionReady: boolean;
  detectedVramMb: number | null;
  reason: "ready" | "gpu_missing" | "vram_below_pilot" | "consent_required";
};

export function evaluateAdultLocalAISetupReadiness(
  runtime: RuntimeProfileState | null,
  consent: AdultLocalAISetupConsent,
): AdultLocalAISetupReadiness {
  const detectedVramMb = runtime?.hardware.dedicatedVramMb ?? null;
  const gpuDetected = Boolean(runtime?.hardware.gpuName);
  const deviceEligible =
    gpuDetected &&
    detectedVramMb !== null &&
    detectedVramMb >= ADULT_PILOT_MINIMUM_VRAM_MB;
  const consentComplete = Object.values(consent).every(Boolean);
  return {
    deviceEligible,
    consentComplete,
    acquisitionReady: deviceEligible && consentComplete,
    detectedVramMb,
    reason: !gpuDetected
      ? "gpu_missing"
      : !deviceEligible
        ? "vram_below_pilot"
        : !consentComplete
          ? "consent_required"
          : "ready",
  };
}
