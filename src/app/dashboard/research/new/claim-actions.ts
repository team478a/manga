"use server";

import { z } from "zod";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import {
  extractCloudResearchClaimCandidates,
  type CloudResearchClaimCandidate,
} from "@/lib/cloud-research-claim-extraction";
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

const inputSchema = z.object({
  url: z
    .string()
    .url("出典URLを確認してください。")
    .refine((value) => value.startsWith("https://"), {
      message: "出典URLはHTTPSで入力してください。",
    }),
  topic: cloudResearchTopicSchema,
});

export type CloudResearchClaimExtractionState = {
  error?: string;
  extractedAt?: string;
  finalUrl?: string;
  textSha256?: string;
  textTruncated?: boolean;
  candidates: CloudResearchClaimCandidate[];
};

export async function extractCloudResearchClaimsAction(
  _previousState: CloudResearchClaimExtractionState,
  formData: FormData,
): Promise<CloudResearchClaimExtractionState> {
  try {
    if (!cloudResearchFeatureEnabled())
      throw new PermissionDeniedError("市場分析機能は現在停止中です。");
    if (!cloudResearchSourceVerificationEnabled())
      throw new PermissionDeniedError(
        "Server出典検証が有効な場合だけ事実候補を抽出できます。",
      );
    const { profile } = await requireProfile();
    const parsed = inputSchema.safeParse({
      url: formData.get("url"),
      topic: formData.get("topic"),
    });
    if (!parsed.success)
      return {
        candidates: [],
        error:
          parsed.error.issues[0]?.message ??
          "事実候補の抽出条件を確認してください。",
      };

    await enforceCloudResearchClaimExtractionRateLimit(profile.id);
    const snapshot = await verifyResearchSource(
      parsed.data.url,
      fetchCloudResearchSourceSnapshot,
    );
    const result = extractCloudResearchClaimCandidates(
      snapshot,
      parsed.data.topic,
    );
    return {
      extractedAt: result.extractedAt,
      finalUrl: result.sourceVerification.finalUrl,
      textSha256: result.textSha256,
      textTruncated: result.textTruncated,
      candidates: result.candidates,
    };
  } catch (error) {
    return {
      candidates: [],
      error: safeDomainErrorMessage(
        error,
        "出典から事実候補を抽出できませんでした。",
      ),
    };
  }
}
