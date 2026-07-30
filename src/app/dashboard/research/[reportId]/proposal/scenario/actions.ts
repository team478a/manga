"use server";

import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { getCloudProposalSelection } from "@/lib/cloud-proposal-server";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { runCloudScenarioAi } from "@/lib/cloud-scenario-ai";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import {
  adoptCloudScenario,
  createCloudScenarioVersion,
  getCloudScenarioVersion,
} from "@/lib/cloud-scenario-server";
import { PermissionDeniedError, ResourceNotFoundError } from "@/lib/domain-errors";
import { enforceCloudScenarioAiRateLimit } from "@/lib/cloud-research-search-rate-limit";

function assertEnabled() {
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled() || !cloudScenarioFeatureEnabled())
    throw new PermissionDeniedError("AIシナリオ生成機能は現在停止中です。");
}

export async function createCloudScenarioAction(reportId: string) {
  let versionId = "";
  try {
    assertEnabled();
    const { profile } = await requireProfile();
    await enforceCloudScenarioAiRateLimit(profile.id);
    const [report, selection] = await Promise.all([
      getCloudResearchReport(profile.id, reportId),
      getCloudProposalSelection(profile.id, reportId),
    ]);
    if (!selection) throw new ResourceNotFoundError("採用済み企画が見つかりません。");
    if (selection.content_class !== "general")
      throw new PermissionDeniedError("成人向けシナリオ生成は現在準備中です。");
    const result = await runCloudScenarioAi({ profileId: profile.id, report, selection });
    versionId = await createCloudScenarioVersion({
      profileId: profile.id, reportId, selectionId: selection.id, result,
    });
  } catch (error) {
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario?error=${encodeURIComponent(safeDomainErrorMessage(error, "シナリオを生成できませんでした。"))}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(versionId)}?message=${encodeURIComponent("初稿シナリオを作成しました")}`);
}

export async function reviseCloudScenarioAction(reportId: string, versionId: string, formData: FormData) {
  let nextId = "";
  try {
    assertEnabled();
    const { profile } = await requireProfile();
    await enforceCloudScenarioAiRateLimit(profile.id);
    const [report, selection, parent] = await Promise.all([
      getCloudResearchReport(profile.id, reportId),
      getCloudProposalSelection(profile.id, reportId),
      getCloudScenarioVersion(profile.id, versionId),
    ]);
    if (!selection || parent.research_report_id !== reportId || parent.proposal_selection_id !== selection.id)
      throw new ResourceNotFoundError("修正元シナリオが見つかりません。");
    if (selection.content_class !== "general")
      throw new PermissionDeniedError("成人向けシナリオ生成は現在準備中です。");
    const revisionInstruction = String(formData.get("revisionInstruction") ?? "").trim();
    const result = await runCloudScenarioAi({
      profileId: profile.id, report, selection, parentVersion: parent, revisionInstruction,
    });
    nextId = await createCloudScenarioVersion({
      profileId: profile.id, reportId, selectionId: selection.id, parentVersionId: parent.id,
      revisionInstruction, result,
    });
  } catch (error) {
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(versionId)}?error=${encodeURIComponent(safeDomainErrorMessage(error, "シナリオを修正できませんでした。"))}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(nextId)}?message=${encodeURIComponent("修正版シナリオを作成しました")}`);
}

export async function adoptCloudScenarioAction(reportId: string, versionId: string) {
  try {
    assertEnabled();
    const { profile } = await requireProfile();
    const version = await getCloudScenarioVersion(profile.id, versionId);
    if (version.research_report_id !== reportId) throw new ResourceNotFoundError("シナリオが見つかりません。");
    await adoptCloudScenario(profile.id, version);
  } catch (error) {
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(versionId)}?error=${encodeURIComponent(safeDomainErrorMessage(error, "シナリオを採用できませんでした。"))}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(versionId)}?message=${encodeURIComponent("このシナリオを採用しました")}`);
}
