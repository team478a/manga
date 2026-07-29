"use server";

import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import {
  cloudResearchSearchInputSchema,
  configuredCloudResearchSearchProvider,
  type CloudResearchSearchCandidate,
  type CloudResearchSearchResult,
} from "@/lib/cloud-research-search";
import { enforceCloudResearchSearchRateLimit } from "@/lib/cloud-research-search-rate-limit";
import { PermissionDeniedError } from "@/lib/domain-errors";

export type CloudResearchDiscoveryState = {
  error?: string;
  provider?: CloudResearchSearchResult["provider"];
  searchedAt?: string;
  topic?: CloudResearchSearchResult["topic"];
  candidates: CloudResearchSearchCandidate[];
};

export async function discoverCloudResearchSourcesAction(
  _previousState: CloudResearchDiscoveryState,
  formData: FormData,
): Promise<CloudResearchDiscoveryState> {
  try {
    if (!cloudResearchFeatureEnabled())
      throw new PermissionDeniedError("市場分析機能は現在停止中です。");
    const { profile } = await requireProfile();
    const parsed = cloudResearchSearchInputSchema.safeParse({
      query: formData.get("query"),
      topic: formData.get("topic"),
      freshness: formData.get("freshness"),
    });
    if (!parsed.success)
      return {
        candidates: [],
        error:
          parsed.error.issues[0]?.message ?? "検索条件を確認してください。",
      };
    const provider = configuredCloudResearchSearchProvider();
    await enforceCloudResearchSearchRateLimit(profile.id);
    const result = await provider.search(parsed.data);
    return result;
  } catch (error) {
    return {
      candidates: [],
      error: safeDomainErrorMessage(
        error,
        "出典候補を検索できませんでした。",
      ),
    };
  }
}
