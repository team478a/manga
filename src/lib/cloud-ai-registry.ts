import {
  cloudProviderCapabilitySchema,
  type CloudGenerationInput,
  type CloudProviderCapability,
} from "@mangai/ai-core";
import {
  getCloudGeneralImageRuntimeConfig,
} from "./cloud-general-image-settings.ts";

export function configuredCapabilities(): CloudProviderCapability[] {
  const imagePricingVersion =
    process.env.MANGAI_CLOUD_IMAGE_PRICING_VERSION?.trim();
  const textPricingVersion =
    process.env.MANGAI_CLOUD_TEXT_PRICING_VERSION?.trim();
  const capabilities: CloudProviderCapability[] = [
    cloudProviderCapabilitySchema.parse({
      providerId: "mangai-cloud-image",
      modelId: process.env.MANGAI_CLOUD_IMAGE_MODEL ?? "general-image-v1",
      kind: "image",
      jobTypes: ["background", "prop", "effect", "character_base"],
      operations: ["text_to_image", "image_to_image"],
      policyVersion: "general-v1",
      pricingVersion: imagePricingVersion || "unconfigured",
      enabled:
        process.env.MANGAI_CLOUD_IMAGE_ENABLED === "true" &&
        Boolean(imagePricingVersion),
    }),
    cloudProviderCapabilitySchema.parse({
      providerId: "mangai-cloud-text",
      modelId: process.env.MANGAI_CLOUD_TEXT_MODEL ?? "general-text-v1",
      kind: "text",
      jobTypes: ["story", "storyboard", "speech_bubble"],
      policyVersion: "general-v1",
      pricingVersion: textPricingVersion || "unconfigured",
      enabled:
        process.env.MANGAI_CLOUD_TEXT_ENABLED === "true" &&
        Boolean(textPricingVersion),
    }),
  ];
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.MANGAI_CLOUD_AI_MOCK_ENABLED === "true"
  )
    capabilities.unshift(
      cloudProviderCapabilitySchema.parse({
        providerId: "mangai-cloud-mock-image",
        modelId: "mock-image-v1",
        kind: "image",
        jobTypes: ["background", "prop", "effect", "character_base"],
        operations: ["text_to_image", "image_to_image"],
        policyVersion: "general-v1",
        pricingVersion: "mock-free-v1",
        enabled: true,
      }),
      cloudProviderCapabilitySchema.parse({
        providerId: "mangai-cloud-mock-text",
        modelId: "mock-text-v1",
        kind: "text",
        jobTypes: ["story", "storyboard", "speech_bubble"],
        policyVersion: "general-v1",
        pricingVersion: "mock-free-v1",
        enabled: true,
      }),
    );
  return capabilities;
}

export function listCloudProviderCapabilities() {
  return configuredCapabilities().map((capability) => ({ ...capability }));
}

export async function configuredRuntimeCapabilities() {
  const capabilities = configuredCapabilities();
  try {
    const image = await getCloudGeneralImageRuntimeConfig();
    capabilities.unshift(
      cloudProviderCapabilitySchema.parse({
        providerId: "black-forest-labs",
        modelId: image.model,
        kind: "image",
        jobTypes: ["background", "prop", "effect", "character_base"],
        operations: ["text_to_image", "image_to_image"],
        policyVersion: "general-v1",
        pricingVersion: image.pricingVersion,
        enabled: true,
      }),
    );
    if (process.env.CLOUD_PANEL_INPAINTING_ENABLED === "true")
      capabilities.unshift(
        cloudProviderCapabilitySchema.parse({
          providerId: "black-forest-labs",
          modelId: "flux-pro-1.0-fill",
          kind: "image",
          jobTypes: ["background"],
          operations: ["inpainting"],
          policyVersion: "general-v1",
          pricingVersion: "bfl-flux1-fill-2026-08",
          enabled: true,
        }),
      );
  } catch {
    // The Vault-backed provider is intentionally fail closed until configured.
  }
  return capabilities;
}

export async function selectCloudProvider(input: CloudGenerationInput) {
  const operation =
    input.kind === "image" ? (input.operation ?? "text_to_image") : undefined;
  const capability = (await configuredRuntimeCapabilities()).find(
    (candidate) =>
      candidate.enabled &&
      candidate.kind === input.kind &&
      candidate.jobTypes.includes(input.jobType) &&
      (!operation || !candidate.operations || candidate.operations.includes(operation)),
  );
  if (!capability)
    throw new Error(
      "一般向けCloud AI Providerは現在停止中です。編集・保存・書き出しは引き続き利用できます。",
    );
  return capability;
}
