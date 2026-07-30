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
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { runCloudProposalAi } from "@/lib/cloud-proposal-ai";
import { runCloudAdultProposalAi } from "@/lib/cloud-proposal-ai";
import {
  assertCloudAdultAiPlanningAllowed,
  getCloudAdultAiPlanningAccess,
  recordCloudAdultAiPlanningConsent,
} from "@/lib/cloud-adult-ai-planning";
import {
  createCloudProposalRun,
  getCloudProposalRun,
  selectCloudProposal,
} from "@/lib/cloud-proposal-server";
import { enforceCloudProposalAiRateLimit } from "@/lib/cloud-research-search-rate-limit";

export async function createCloudProposalAction(
  reportId: string,
) {
  let runId = "";
  try {
    if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled())
      throw new PermissionDeniedError("AI企画提案機能は現在停止中です。");
    const { profile } = await requireProfile();
    await enforceCloudProposalAiRateLimit(profile.id);
    const report = await getCloudResearchReport(profile.id, reportId);
    if (report.input.contentClass !== "general")
      throw new PermissionDeniedError("一般向け市場分析Reportを選んでください。");
    const result = await runCloudProposalAi({ profileId: profile.id, report });
    runId = await createCloudProposalRun({
      profileId: profile.id,
      reportId: report.id,
      contentClass: "general",
      result,
    });
  } catch (error) {
    const message = safeDomainErrorMessage(error, "企画候補を生成できませんでした。");
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal?error=${encodeURIComponent(message)}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/runs/${encodeURIComponent(runId)}?message=${encodeURIComponent("企画候補を3案作成しました")}`);
}

export async function consentCloudAdultAiPlanningAction(
  reportId: string,
  formData: FormData,
) {
  try {
    const { profile } = await requireProfile();
    const report = await getCloudResearchReport(profile.id, reportId);
    if (report.input.contentClass !== "adult")
      throw new PermissionDeniedError("成人向け市場分析Reportを選んでください。");
    await recordCloudAdultAiPlanningConsent(profile.id, formData);
  } catch (error) {
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal?error=${encodeURIComponent(safeDomainErrorMessage(error, "同意を保存できませんでした。"))}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal?message=${encodeURIComponent("成人向けAI企画の利用条件に同意しました")}`);
}

export async function createCloudAdultProposalAction(reportId: string) {
  let runId = "";
  try {
    if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled())
      throw new PermissionDeniedError("AI企画提案機能は現在停止中です。");
    const { profile } = await requireProfile();
    await enforceCloudProposalAiRateLimit(profile.id);
    const report = await getCloudResearchReport(profile.id, reportId);
    if (report.input.contentClass !== "adult")
      throw new PermissionDeniedError("成人向け市場分析Reportを選んでください。");
    assertCloudAdultAiPlanningAllowed(await getCloudAdultAiPlanningAccess(profile.id));
    const result = await runCloudAdultProposalAi({ profileId: profile.id, report });
    runId = await createCloudProposalRun({
      profileId: profile.id,
      reportId: report.id,
      contentClass: "adult",
      result,
    });
  } catch (error) {
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal?error=${encodeURIComponent(safeDomainErrorMessage(error, "成人向け企画候補を生成できませんでした。"))}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/runs/${encodeURIComponent(runId)}?message=${encodeURIComponent("成人向け企画候補を3案作成しました")}`);
}

export async function selectCloudProposalAction(
  reportId: string,
  runId: string,
  formData: FormData,
) {
  try {
    if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled())
      throw new PermissionDeniedError("AI企画提案機能は現在停止中です。");
    const { profile } = await requireProfile();
    const run = await getCloudProposalRun(profile.id, runId);
    if (run.research_report_id !== reportId)
      throw new PermissionDeniedError("市場分析Reportと企画の組み合わせを確認してください。");
    await selectCloudProposal({
      profileId: profile.id,
      run,
      candidateId: String(formData.get("candidateId") ?? ""),
    });
  } catch (error) {
    const message = safeDomainErrorMessage(error, "企画を選択できませんでした。");
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/runs/${encodeURIComponent(runId)}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/runs/${encodeURIComponent(runId)}?message=${encodeURIComponent("制作する企画を決定しました")}`);
}

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
