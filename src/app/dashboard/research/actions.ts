"use server";

import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import {
  assertCloudResearchContentAllowed,
  getCloudAdultResearchAccess,
} from "@/lib/cloud-adult-research";
import {
  cloudResearchFeatureEnabled,
  parseCloudResearchRequestForm,
} from "@/lib/cloud-research";
import { runCloudResearchAiAnalysis } from "@/lib/cloud-research-ai";
import { createCloudResearchReport } from "@/lib/cloud-research-server";
import { enforceCloudResearchAiAnalysisRateLimit } from "@/lib/cloud-research-search-rate-limit";
import { PermissionDeniedError } from "@/lib/domain-errors";
import { consumeCloudAdultMonitorAiRequest } from "@/lib/cloud-adult-monitor";

export async function createCloudResearchReportAction(formData: FormData) {
  let reportId: string;
  try {
    if (!cloudResearchFeatureEnabled())
      throw new PermissionDeniedError("市場分析機能は現在停止中です。");
    const { profile } = await requireProfile();
    const request = parseCloudResearchRequestForm(formData);
    const adultAccess =
      request.contentClass === "adult"
        ? await getCloudAdultResearchAccess(profile.id)
        : {
            allowed: false,
            reason: "feature_disabled" as const,
            entitlement: null,
            consent: null,
          };
    assertCloudResearchContentAllowed(request, adultAccess);
    await enforceCloudResearchAiAnalysisRateLimit(profile.id);
    if (request.contentClass === "adult")
      await consumeCloudAdultMonitorAiRequest(profile.id, "research");
    const { input, result } = await runCloudResearchAiAnalysis({
      profileId: profile.id,
      request,
    });
    reportId = await createCloudResearchReport({
      profileId: profile.id,
      input,
      result,
    });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "市場分析を完了できませんでした。",
    );
    redirect(
      `/dashboard/research/new?error=${encodeURIComponent(message)}`,
    );
  }
  redirect(`/dashboard/research/${reportId}?message=市場分析を保存しました`);
}
