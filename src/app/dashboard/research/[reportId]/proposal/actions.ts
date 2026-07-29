"use server";

import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import {
  assertCloudAdultPlanningAllowed,
  cloudAdultPlanningFeatureEnabled,
  createCloudAdultPlanningBrief,
  getCloudAdultPlanningAccess,
  parseCloudAdultPlanningForm,
} from "@/lib/cloud-adult-planning";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { PermissionDeniedError } from "@/lib/domain-errors";

export async function createCloudAdultPlanningBriefAction(
  reportId: string,
  formData: FormData,
) {
  let briefId = "";
  try {
    if (
      !cloudResearchFeatureEnabled() ||
      !cloudAdultPlanningFeatureEnabled()
    )
      throw new PermissionDeniedError(
        "成人向け企画機能は現在停止中です。",
      );
    const { profile } = await requireProfile();
    const report = await getCloudResearchReport(profile.id, reportId);
    if (report.input.contentClass !== "adult")
      throw new PermissionDeniedError(
        "この企画機能は成人向け市場分析Report専用です。",
      );
    const access = await getCloudAdultPlanningAccess(profile.id);
    assertCloudAdultPlanningAllowed(access);
    const input = parseCloudAdultPlanningForm(formData);
    briefId = await createCloudAdultPlanningBrief({
      profileId: profile.id,
      researchReportId: report.id,
      input,
    });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "企画ブリーフを保存できませんでした。",
    );
    redirect(
      `/dashboard/research/${encodeURIComponent(reportId)}/proposal?error=${encodeURIComponent(message)}`,
    );
  }
  redirect(
    `/dashboard/research/${encodeURIComponent(reportId)}/proposal/${encodeURIComponent(briefId)}?message=${encodeURIComponent("企画ブリーフを保存しました")}`,
  );
}
