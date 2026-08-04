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
import { PermissionDeniedError, QuotaExceededError } from "@/lib/domain-errors";
import {
  consumeCloudGeneralMonitorAiRequest,
  requireCloudGeneralMonitor,
} from "@/lib/cloud-general-monitor";

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
    const enrollment = await requireCloudGeneralMonitor(profile.id);
    if (enrollment.ai_requests_used >= enrollment.ai_request_limit)
      throw new QuotaExceededError(
        "モニター期間中のAI利用上限に達しました。管理者へご連絡ください。",
      );
    const { input, result } = await runCloudResearchAiAnalysis({
      profileId: profile.id,
      request,
    });
    await consumeCloudGeneralMonitorAiRequest(profile.id, "research");
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
  redirect(encodeURI(`/dashboard/research/${reportId}?message=市場分析を保存しました`));
}
