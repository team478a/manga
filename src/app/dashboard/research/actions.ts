"use server";

import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import {
  cloudResearchFeatureEnabled,
  parseCloudResearchRequestForm,
} from "@/lib/cloud-research";
import { runCloudResearchAiAnalysis } from "@/lib/cloud-research-ai";
import { createCloudResearchReport } from "@/lib/cloud-research-server";
import { enforceCloudResearchAiAnalysisRateLimit } from "@/lib/cloud-research-search-rate-limit";
import { PermissionDeniedError } from "@/lib/domain-errors";
import { consumeCloudGeneralMonitorAiRequest } from "@/lib/cloud-general-monitor";

export async function createCloudResearchReportAction(formData: FormData) {
  let reportId: string;
  try {
    if (!cloudResearchFeatureEnabled())
      throw new PermissionDeniedError("市場分析機能は現在停止中です。");
    const { profile } = await requireProfile();
    const request = parseCloudResearchRequestForm(formData);
    if (request.contentClass !== "general")
      throw new PermissionDeniedError(
        "今回の限定モニターは一般向け作品のみ利用できます。",
      );
    await enforceCloudResearchAiAnalysisRateLimit(profile.id);
    await consumeCloudGeneralMonitorAiRequest(profile.id, "research");
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
