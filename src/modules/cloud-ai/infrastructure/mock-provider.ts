import crypto from "node:crypto";
import sharp from "sharp";
import type {
  CloudGenerationContext,
  CloudGenerationInput,
  CloudImageGenerationProvider,
  CloudProviderCapability,
  CloudTextGenerationProvider,
} from "@mangai/ai-core";

export class MockCloudImageProvider implements CloudImageGenerationProvider {
  readonly capability: CloudProviderCapability & { kind: "image" } = {
    providerId: "mangai-cloud-mock-image",
    modelId: "mock-image-v1",
    kind: "image" as const,
    jobTypes: ["background", "prop", "effect", "character_base"],
    policyVersion: "general-v1",
    pricingVersion: "mock-free-v1",
    enabled: true,
  };

  async generate(
    input: CloudGenerationInput & { kind: "image" },
    context: CloudGenerationContext,
  ) {
    const width = input.width ?? 768;
    const height = input.height ?? 768;
    const hash = crypto.createHash("sha256").update(input.prompt).digest("hex");
    const color = `#${hash.slice(0, 6)}`;
    const accent = `#${hash.slice(6, 12)}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/><circle cx="50%" cy="50%" r="35%" fill="${accent}" opacity="0.7"/></svg>`;
    const bytes = new Uint8Array(
      await sharp(Buffer.from(svg)).png().toBuffer(),
    );
    return {
      providerJobId: `mock-${context.jobId}`,
      images: [{ bytes, mimeType: "image/png", fileName: "mock.png" }],
      usage: { actualCostMicros: 0 },
    };
  }
}

export class MockCloudTextProvider implements CloudTextGenerationProvider {
  readonly capability: CloudProviderCapability & { kind: "text" } = {
    providerId: "mangai-cloud-mock-text",
    modelId: "mock-text-v1",
    kind: "text" as const,
    jobTypes: ["story", "storyboard", "speech_bubble"],
    policyVersion: "general-v1",
    pricingVersion: "mock-free-v1",
    enabled: true,
  };

  async generate(
    input: CloudGenerationInput & { kind: "text" },
    context: CloudGenerationContext,
  ) {
    return {
      providerJobId: `mock-${context.jobId}`,
      text: `【Mock生成】${input.prompt}`,
      usage: {
        inputUnits: input.prompt.length,
        outputUnits: input.prompt.length + 8,
        actualCostMicros: 0,
      },
    };
  }
}
