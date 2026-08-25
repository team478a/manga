import { cloudGenerationInputSchema } from "@mangai/ai-core";

export type CloudGenerationProvenance = {
  providerId: string; modelId: string; seed: number | null; workflowVersion: string | null;
  characterVersions: Array<{ profileId: string; version: number }>;
  referenceBundleVersion: number | null; referenceResolverVersion: string | null;
  references: Array<{ profileId: string; profileVersion: number; assetId: string; role: string }>;
  styleVersion: { bibleId: string; version: number } | null;
  worldVersions: Array<{ profileId: string; version: number; kind: "location" | "prop" }>;
  continuityStateCount: number;
};

export function extractCloudGenerationProvenance(input: unknown, providerId: string, modelId: string): CloudGenerationProvenance {
  const parsed=cloudGenerationInputSchema.safeParse(input);const value=parsed.success?parsed.data:null;
  return {providerId,modelId,seed:value?.seed??null,workflowVersion:value?.workflowVersion??null,
    characterVersions:value?.characterProfileVersions??[],referenceBundleVersion:value?.referenceBundleVersion??null,
    referenceResolverVersion:value?.referenceResolverVersion??null,references:value?.resolvedCharacterReferences??[],
    styleVersion:value?.styleBibleVersion??null,worldVersions:value?.worldProfileVersions??[],
    continuityStateCount:value?.panelContinuityStates?.length??0};
}
