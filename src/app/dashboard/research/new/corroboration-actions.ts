"use server";

import { z } from "zod";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { extractCloudResearchClaimCandidates } from "@/lib/cloud-research-claim-extraction";
import {
  compareCloudResearchClaimCandidates,
  type CloudResearchCorroborationResult,
} from "@/lib/cloud-research-corroboration";
import {
  cloudResearchFeatureEnabled,
  cloudResearchTopicSchema,
} from "@/lib/cloud-research";
import { enforceCloudResearchClaimExtractionRateLimit } from "@/lib/cloud-research-search-rate-limit";
import {
  cloudResearchSourceVerificationEnabled,
  fetchCloudResearchSourceSnapshot,
} from "@/lib/cloud-research-source-verification";
import { PermissionDeniedError } from "@/lib/domain-errors";
import { verifyResearchSource } from "@/modules/research/application/verify-source";
import { areDistinctResearchSources } from "@/modules/research/domain/source-policy";

const httpsUrl = z
  .string()
  .url("出典URLを確認してください。")
  .refine((value) => value.startsWith("https://"), {
    message: "出典URLはHTTPSで入力してください。",
  });

const inputSchema = z
  .object({
    primaryUrl: httpsUrl,
    comparisonUrl: httpsUrl,
    topic: cloudResearchTopicSchema,
  })
  .refine((value) =>
    areDistinctResearchSources(value.primaryUrl, value.comparisonUrl), {
      message: "比較する2つの出典URLは異なるものを指定してください。",
      path: ["comparisonUrl"],
    });

export type CloudResearchCorroborationState = {
  error?: string;
  result?: CloudResearchCorroborationResult;
};

export async function compareCloudResearchClaimsAction(
  _previousState: CloudResearchCorroborationState,
  formData: FormData,
): Promise<CloudResearchCorroborationState> {
  try {
    if (!cloudResearchFeatureEnabled())
      throw new PermissionDeniedError("市場分析機能は現在停止中です。");
    if (!cloudResearchSourceVerificationEnabled())
      throw new PermissionDeniedError(
        "Server出典検証が有効な場合だけ出典を照合できます。",
      );
    const { profile } = await requireProfile();
    const parsed = inputSchema.safeParse({
      primaryUrl: formData.get("primaryUrl"),
      comparisonUrl: formData.get("comparisonUrl"),
      topic: formData.get("topic"),
    });
    if (!parsed.success)
      return {
        error:
          parsed.error.issues[0]?.message ??
          "出典の照合条件を確認してください。",
      };

    await enforceCloudResearchClaimExtractionRateLimit(profile.id);
    const [primarySnapshot, comparisonSnapshot] = await Promise.all([
      verifyResearchSource(
        parsed.data.primaryUrl,
        fetchCloudResearchSourceSnapshot,
      ),
      verifyResearchSource(
        parsed.data.comparisonUrl,
        fetchCloudResearchSourceSnapshot,
      ),
    ]);
    const primary = extractCloudResearchClaimCandidates(
      primarySnapshot,
      parsed.data.topic,
    );
    const comparison = extractCloudResearchClaimCandidates(
      comparisonSnapshot,
      parsed.data.topic,
    );
    return {
      result: compareCloudResearchClaimCandidates(primary, comparison),
    };
  } catch (error) {
    return {
      error: safeDomainErrorMessage(
        error,
        "2つの出典を照合できませんでした。",
      ),
    };
  }
}
