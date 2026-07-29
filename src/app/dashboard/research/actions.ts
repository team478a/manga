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
  parseCloudResearchForm,
  runCloudMarketAnalysis,
} from "@/lib/cloud-research";
import { createCloudResearchReport } from "@/lib/cloud-research-server";
import { maybeVerifyCloudResearchSources } from "@/lib/cloud-research-source-verification";
import { PermissionDeniedError } from "@/lib/domain-errors";

export async function createCloudResearchReportAction(formData: FormData) {
  let reportId: string;
  try {
    if (!cloudResearchFeatureEnabled())
      throw new PermissionDeniedError("市場分析機能は現在停止中です。");
    const { profile } = await requireProfile();
    const parsedInput = parseCloudResearchForm(formData, { allowAdult: true });
    const adultAccess =
      parsedInput.contentClass === "adult"
        ? await getCloudAdultResearchAccess(profile.id)
        : {
            allowed: false,
            reason: "feature_disabled" as const,
            entitlement: null,
            consent: null,
          };
    assertCloudResearchContentAllowed(parsedInput, adultAccess);
    const input = await maybeVerifyCloudResearchSources(
      parsedInput,
    );
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
