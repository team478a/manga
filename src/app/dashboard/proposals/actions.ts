"use server";

import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import {
  cloudProposalFeatureEnabled,
  runCloudStoryProposal,
} from "@/lib/cloud-proposal";
import {
  createCloudProposalRun,
  getCloudProposalRun,
  selectCloudProposal,
} from "@/lib/cloud-proposal-server";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { PermissionDeniedError } from "@/lib/domain-errors";

function assertEnabled() {
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled())
    throw new PermissionDeniedError("AI企画提案機能は現在停止中です。");
}
export async function createCloudProposalAction(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");
  let runId: string;
  try {
    assertEnabled();
    const { profile } = await requireProfile();
    const report = await getCloudResearchReport(profile.id, reportId);
    const result = runCloudStoryProposal({
      input: report.input,
      findings: report.result.findings,
      sourceUrls: report.sources.map((source) => source.url),
    });
    runId = await createCloudProposalRun({
      profileId: profile.id,
      reportId: report.id,
      result,
    });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "企画候補を生成できませんでした。",
    );
    redirect(
      `/dashboard/research/${encodeURIComponent(reportId)}/proposal?error=${encodeURIComponent(message)}`,
    );
  }
  redirect(`/dashboard/proposals/${runId}?message=企画候補を保存しました`);
}

export async function selectCloudProposalAction(formData: FormData) {
  const runId = String(formData.get("runId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  try {
    assertEnabled();
    const { profile } = await requireProfile();
    const run = await getCloudProposalRun(profile.id, runId);
    await selectCloudProposal({ profileId: profile.id, run, candidateId });
  } catch (error) {
    const message = safeDomainErrorMessage(error, "企画を採用できませんでした。");
    redirect(
      `/dashboard/proposals/${encodeURIComponent(runId)}?error=${encodeURIComponent(message)}`,
    );
  }
  redirect(`/dashboard/proposals/${runId}?message=企画を採用しました`);
}
