"use server";

import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { getCloudProposalSelection } from "@/lib/cloud-proposal-server";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { runCloudScenarioAi } from "@/lib/cloud-scenario-ai";
import { runCloudAdultScenarioAi } from "@/lib/cloud-scenario-ai";
import {
  assertCloudAdultScenarioAllowed,
  getCloudAdultScenarioAccess,
  recordCloudAdultScenarioConsent,
} from "@/lib/cloud-adult-scenario";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import {
  adoptCloudScenario,
  createCloudScenarioVersion,
  getCloudScenarioVersion,
} from "@/lib/cloud-scenario-server";
import { PermissionDeniedError, ResourceNotFoundError } from "@/lib/domain-errors";
import { enforceCloudScenarioAiRateLimit } from "@/lib/cloud-research-search-rate-limit";
import { consumeCloudGeneralMonitorAiRequest } from "@/lib/cloud-general-monitor";
import { consumeCloudAdultMonitorAiRequest } from "@/lib/cloud-adult-monitor";

function assertEnabled() {
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled() || !cloudScenarioFeatureEnabled())
    throw new PermissionDeniedError("AIシナリオ生成機能は現在停止中です。");
}

async function assertContentClassAccess(profileId: string, contentClass: "general" | "adult") {
  if (contentClass === "adult")
    assertCloudAdultScenarioAllowed(await getCloudAdultScenarioAccess(profileId));
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
    await assertContentClassAccess(profile.id, selection.content_class);
    if (selection.content_class === "adult")
      await consumeCloudAdultMonitorAiRequest(profile.id, "scenario");
    else
      await consumeCloudGeneralMonitorAiRequest(profile.id, "scenario");
    const result = selection.content_class === "adult"
      ? await runCloudAdultScenarioAi({ profileId: profile.id, report, selection })
      : await runCloudScenarioAi({ profileId: profile.id, report, selection });
    versionId = await createCloudScenarioVersion({
      profileId: profile.id, reportId, selectionId: selection.id,
      contentClass: selection.content_class, result,
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
    if (parent.content_class !== selection.content_class)
      throw new ResourceNotFoundError("修正元シナリオが見つかりません。");
    await assertContentClassAccess(profile.id, selection.content_class);
    if (selection.content_class === "adult")
      await consumeCloudAdultMonitorAiRequest(profile.id, "scenario");
    else
      await consumeCloudGeneralMonitorAiRequest(profile.id, "scenario");
    const revisionInstruction = String(formData.get("revisionInstruction") ?? "").trim();
    const aiInput = { profileId: profile.id, report, selection, parentVersion: parent, revisionInstruction };
    const result = selection.content_class === "adult"
      ? await runCloudAdultScenarioAi(aiInput)
      : await runCloudScenarioAi(aiInput);
    nextId = await createCloudScenarioVersion({
      profileId: profile.id, reportId, selectionId: selection.id, parentVersionId: parent.id,
      contentClass: selection.content_class, revisionInstruction, result,
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
    await assertContentClassAccess(profile.id, version.content_class);
    await adoptCloudScenario(profile.id, version);
  } catch (error) {
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(versionId)}?error=${encodeURIComponent(safeDomainErrorMessage(error, "シナリオを採用できませんでした。"))}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(versionId)}?message=${encodeURIComponent("このシナリオを採用しました")}`);
}

export async function consentCloudAdultScenarioAction(reportId: string, formData: FormData) {
  try {
    assertEnabled();
    const { profile } = await requireProfile();
    await recordCloudAdultScenarioConsent(profile.id, formData);
  } catch (error) {
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario?error=${encodeURIComponent(safeDomainErrorMessage(error, "利用条件を保存できませんでした。"))}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario?message=${encodeURIComponent("成人向けAIシナリオの利用条件を確認しました")}`);
}
