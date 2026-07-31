import { getCloudAdultGrokRuntimeConfig } from "./cloud-adult-grok-settings.ts";
import { getCloudResearchAiRuntimeConfig } from "./cloud-research-ai-settings.ts";

export type CloudTextProviderRuntime = {
  provider: "openai" | "xai";
  endpoint: string;
  apiKey: string;
  model: string;
};
export type CloudTextProviderRuntimeOverride = {
  provider?: "openai" | "xai";
  endpoint?: string;
  apiKey: string;
  model: string;
};

export async function getCloudTextProviderRuntime(
  contentClass: "general" | "adult",
): Promise<CloudTextProviderRuntime> {
  if (contentClass === "adult") return getCloudAdultGrokRuntimeConfig();
  const runtime = await getCloudResearchAiRuntimeConfig();
  return {
    provider: "openai",
    endpoint: "https://api.openai.com/v1/responses",
    ...runtime,
  };
}

export async function resolveCloudTextProviderRuntime(
  contentClass: "general" | "adult",
  override?: CloudTextProviderRuntimeOverride,
): Promise<CloudTextProviderRuntime> {
  if (!override) return getCloudTextProviderRuntime(contentClass);
  const provider = override.provider ?? (contentClass === "adult" ? "xai" : "openai");
  return {
    provider,
    endpoint:
      override.endpoint ??
      (provider === "xai"
        ? "https://api.x.ai/v1/responses"
        : "https://api.openai.com/v1/responses"),
    apiKey: override.apiKey,
    model: override.model,
  };
}

export function providerSpecificRequestFields(
  runtime: CloudTextProviderRuntime,
  safetyIdentifier: string,
) {
  return runtime.provider === "openai"
    ? { safety_identifier: safetyIdentifier }
    : {};
}
