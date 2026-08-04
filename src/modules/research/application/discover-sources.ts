import type {
  CloudResearchSearchInput,
  CloudResearchSearchResult,
} from "../contracts/research-search.ts";

export interface CloudResearchSearchProvider {
  readonly providerId: CloudResearchSearchResult["provider"];
  search(input: CloudResearchSearchInput): Promise<CloudResearchSearchResult>;
}

export async function discoverResearchSources(
  input: {
    profileId: string;
    search: CloudResearchSearchInput;
  },
  dependencies: {
    provider: CloudResearchSearchProvider;
    enforceRateLimit(profileId: string): Promise<void>;
  },
) {
  await dependencies.enforceRateLimit(input.profileId);
  return dependencies.provider.search(input.search);
}
