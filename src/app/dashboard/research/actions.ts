"use server";

import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import {
  cloudResearchFeatureEnabled,
  parseCloudResearchForm,
  runCloudMarketAnalysis,
} from "@/lib/cloud-research";
import { createCloudResearchReport } from "@/lib/cloud-research-server";
import { PermissionDeniedError } from "@/lib/domain-errors";

export async function createCloudResearchReportAction(formData: FormData) {
  let reportId: string;
  try {
    if (!cloudResearchFeatureEnabled())
      throw new PermissionDeniedError("市場分析機能は現在停止中です。");
    const { profile } = await requireProfile();
    const input = parseCloudResearchForm(formData);
    const result = runCloudMarketAnalysis(input);
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

