"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  cloudResearchFeatureEnabled,
  parseCloudResearchRequestForm,
} from "@/lib/cloud-research";
import { runCloudResearchAiAnalysis } from "@/lib/cloud-research-ai";
import { createCloudResearchReport } from "@/lib/cloud-research-server";
import { enforceCloudResearchAiAnalysisRateLimit } from "@/lib/cloud-research-search-rate-limit";
import {
  consumeCloudGeneralMonitorAiRequest,
  requireCloudGeneralMonitor,
} from "@/lib/cloud-general-monitor";
import { generateResearchReport } from "@/modules/research/application/generate-report";
import { researchActionError } from "@/modules/research/presentation/research-actions";

export async function createCloudResearchReportAction(formData: FormData) {
  let reportId: string;
  try {
    const { profile } = await requireProfile();
    const request = parseCloudResearchRequestForm(formData);
    reportId = await generateResearchReport({
      profileId: profile.id,
      request,
    }, {
      featureEnabled: cloudResearchFeatureEnabled,
      enforceRateLimit: enforceCloudResearchAiAnalysisRateLimit,
      async getMonitorAllowance(profileId) {
        const enrollment = await requireCloudGeneralMonitor(profileId);
        return {
          used: enrollment.ai_requests_used,
          limit: enrollment.ai_request_limit,
        };
      },
      analyze: runCloudResearchAiAnalysis,
      async consumeAllowance(profileId) {
        await consumeCloudGeneralMonitorAiRequest(profileId, "research");
      },
      save: createCloudResearchReport,
    });
  } catch (error) {
    const message = researchActionError(
      error,
      "市場分析を完了できませんでした。",
    );
    redirect(
      `/dashboard/research/new?error=${encodeURIComponent(message)}`,
    );
  }
  redirect(encodeURI(`/dashboard/research/${reportId}?message=市場分析を保存しました`));
}
