import {
  cloudProviderCapabilitySchema,
  type CloudGenerationInput,
  type CloudProviderCapability,
} from "@mangai/ai-core";

function configuredCapabilities(): CloudProviderCapability[] {
  return [
    cloudProviderCapabilitySchema.parse({
      providerId: "mangai-cloud-image",
      modelId: process.env.MANGAI_CLOUD_IMAGE_MODEL ?? "general-image-v1",
      kind: "image",
      jobTypes: ["background", "prop", "effect", "character_base"],
      policyVersion: "general-v1",
      pricingVersion: "unconfigured",
      enabled: process.env.MANGAI_CLOUD_IMAGE_ENABLED === "true",
    }),
    cloudProviderCapabilitySchema.parse({
      providerId: "mangai-cloud-text",
      modelId: process.env.MANGAI_CLOUD_TEXT_MODEL ?? "general-text-v1",
      kind: "text",
      jobTypes: ["story", "storyboard", "speech_bubble"],
      policyVersion: "general-v1",
      pricingVersion: "unconfigured",
      enabled: process.env.MANGAI_CLOUD_TEXT_ENABLED === "true",
    }),
  ];
}

export function listCloudProviderCapabilities() {
  return configuredCapabilities().map((capability) => ({ ...capability }));
}

export function selectCloudProvider(input: CloudGenerationInput) {
  const capability = configuredCapabilities().find(
    (candidate) =>
      candidate.enabled &&
      candidate.kind === input.kind &&
      candidate.jobTypes.includes(input.jobType),
  );
  if (!capability)
    throw new Error(
      "一般向けCloud AI Providerは現在停止中です。編集・保存・書き出しは引き続き利用できます。",
    );
  return capability;
}
