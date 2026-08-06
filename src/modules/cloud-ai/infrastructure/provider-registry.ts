import {
  cloudProviderCapabilitySchema,
  type CloudGenerationInput,
  type CloudImageGenerationProvider,
  type CloudProviderCapability,
  type CloudTextGenerationProvider,
} from "@mangai/ai-core";
import {
  getCloudGeneralImageRuntimeConfig,
} from "../../../lib/cloud-general-image-settings.ts";
import { logHubEvent } from "../../../lib/hub-logger.ts";
import { featureFlagEnabled } from "../../../lib/feature-flags.ts";
import { BlackForestLabsFluxImageProvider } from "./bfl-provider.ts";
import {
  MangaiCloudGatewayImageProvider,
  MangaiCloudGatewayTextProvider,
} from "./gateway-provider.ts";
import {
  MockCloudImageProvider,
  MockCloudTextProvider,
} from "./mock-provider.ts";

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
        featureFlagEnabled("MANGAI_CLOUD_IMAGE_ENABLED") &&
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
        featureFlagEnabled("MANGAI_CLOUD_TEXT_ENABLED") &&
        Boolean(textPricingVersion),
    }),
  ];
  if (
    process.env.NODE_ENV !== "production" &&
    featureFlagEnabled("MANGAI_CLOUD_AI_MOCK_ENABLED")
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
    if (
      featureFlagEnabled("CLOUD_PANEL_INPAINTING_ENABLED") ||
      featureFlagEnabled("CLOUD_PANEL_OUTPAINTING_ENABLED")
    )
      capabilities.unshift(
        cloudProviderCapabilitySchema.parse({
          providerId: "black-forest-labs",
          modelId: "flux-pro-1.0-fill",
          kind: "image",
          jobTypes: ["background"],
          operations: ["inpainting", "outpainting"],
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

export async function createConfiguredCloudProviders(): Promise<
  Array<CloudImageGenerationProvider | CloudTextGenerationProvider>
> {
  const providers: Array<
    CloudImageGenerationProvider | CloudTextGenerationProvider
  > =
    process.env.NODE_ENV !== "production" &&
    featureFlagEnabled("MANGAI_CLOUD_AI_MOCK_ENABLED")
      ? [new MockCloudImageProvider(), new MockCloudTextProvider()]
      : [];

  try {
    const image = await getCloudGeneralImageRuntimeConfig();
    const capability = (await configuredRuntimeCapabilities()).find(
      (candidate) =>
        candidate.providerId === "black-forest-labs" &&
        candidate.modelId === image.model &&
        candidate.kind === "image" &&
        candidate.enabled,
    );
    if (capability)
      providers.push(
        new BlackForestLabsFluxImageProvider({
          apiKey: image.apiKey,
          model: image.model,
          capability,
          onDiagnostic: (diagnostic) =>
            logHubEvent("warn", "cloud_ai_bfl_provider_rejected", {
              provider: "black-forest-labs",
              model: image.model,
              ...diagnostic,
            }),
        }),
      );
    const fillCapability = (await configuredRuntimeCapabilities()).find(
      (candidate) =>
        candidate.providerId === "black-forest-labs" &&
        candidate.modelId === "flux-pro-1.0-fill" &&
        candidate.kind === "image" &&
        candidate.enabled,
    );
    if (fillCapability)
      providers.push(
        new BlackForestLabsFluxImageProvider({
          apiKey: image.apiKey,
          model: "flux-pro-1.0-fill",
          capability: fillCapability,
        }),
      );
  } catch {
    // Keep processing text or Gateway jobs when the image provider is disabled.
  }

  const gatewayEndpoint = process.env.MANGAI_CLOUD_AI_GATEWAY_ENDPOINT;
  const gatewayKey = process.env.MANGAI_CLOUD_AI_GATEWAY_KEY;
  if (gatewayEndpoint && gatewayKey) {
    for (const capability of configuredCapabilities().filter(
      (candidate) =>
        candidate.enabled && !candidate.providerId.includes("mock"),
    ))
      providers.push(
        capability.kind === "image"
          ? new MangaiCloudGatewayImageProvider({
              endpoint: `${gatewayEndpoint.replace(/\/$/, "")}/image`,
              apiKey: gatewayKey,
              capability,
            })
          : new MangaiCloudGatewayTextProvider({
              endpoint: `${gatewayEndpoint.replace(/\/$/, "")}/text`,
              apiKey: gatewayKey,
              capability,
            }),
      );
  }
  return providers;
}
