"use server";

import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { getCloudProposalSelectionById } from "@/lib/cloud-proposal-server";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import {
  cloudScenarioFeatureEnabled,
  runCloudScenario,
  scenarioRevisionFocusSchema,
} from "@/lib/cloud-scenario";
import {
  confirmCloudScenario,
  createCloudScenarioRun,
  getCloudScenarioConfirmation,
  getCloudScenarioRun,
} from "@/lib/cloud-scenario-server";
import { PermissionDeniedError, ValidationError } from "@/lib/domain-errors";

function assertEnabled() {
  if (
    !cloudResearchFeatureEnabled() ||
    !cloudProposalFeatureEnabled() ||
    !cloudScenarioFeatureEnabled()
  )
    throw new PermissionDeniedError("シナリオ生成機能は現在停止中です。");
}

async function loadScenarioInput(profileId: string, selectionId: string) {
  const selection = await getCloudProposalSelectionById(profileId, selectionId);
  const report = await getCloudResearchReport(
    profileId,
    selection.research_report_id,
  );
  return { selection, report };
}

export async function createCloudScenarioAction(formData: FormData) {
  const selectionId = String(formData.get("selectionId") ?? "");
  let runId: string;
  try {
    assertEnabled();
    const { profile } = await requireProfile();
    const { selection, report } = await loadScenarioInput(
      profile.id,
      selectionId,
    );
    const result = runCloudScenario({
      proposalSelectionId: selection.id,
      researchReportId: report.id,
      candidate: selection.candidate_snapshot,
      totalPages: report.input.pageCount,
      contentClass: report.input.contentClass,
      focus: "initial",
    });
    runId = await createCloudScenarioRun({
      proposalSelectionId: selection.id,
      result,
    });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "シナリオ初稿を生成できませんでした。",
    );
    redirect(
      `/dashboard/proposals?error=${encodeURIComponent(message)}`,
    );
  }
  redirect(`/dashboard/scenarios/${runId}?message=シナリオ初稿を保存しました`);
}

export async function reviseCloudScenarioAction(formData: FormData) {
  const parentRunId = String(formData.get("runId") ?? "");
  let runId: string;
  try {
    assertEnabled();
    const focus = scenarioRevisionFocusSchema.parse(
      String(formData.get("focus") ?? ""),
    );
    if (focus === "initial")
      throw new ValidationError("改稿方針を選択してください。");
    const { profile } = await requireProfile();
    const parent = await getCloudScenarioRun(profile.id, parentRunId);
    const confirmation = await getCloudScenarioConfirmation(
      profile.id,
      parent.proposal_selection_id,
    );
    if (confirmation)
      throw new ValidationError("確定済みシナリオは改稿できません。");
    const { selection, report } = await loadScenarioInput(
      profile.id,
      parent.proposal_selection_id,
    );
    const result = runCloudScenario({
      proposalSelectionId: selection.id,
      researchReportId: report.id,
      candidate: selection.candidate_snapshot,
      totalPages: report.input.pageCount,
      contentClass: report.input.contentClass,
      focus,
    });
    runId = await createCloudScenarioRun({
      proposalSelectionId: selection.id,
      parentRunId: parent.id,
      result,
    });
  } catch (error) {
    const message = safeDomainErrorMessage(error, "改稿版を生成できませんでした。");
    redirect(
      `/dashboard/scenarios/${encodeURIComponent(parentRunId)}?error=${encodeURIComponent(message)}`,
    );
  }
  redirect(`/dashboard/scenarios/${runId}?message=改稿版を保存しました`);
}

export async function confirmCloudScenarioAction(formData: FormData) {
  const runId = String(formData.get("runId") ?? "");
  try {
    assertEnabled();
    const { profile } = await requireProfile();
    const run = await getCloudScenarioRun(profile.id, runId);
    await confirmCloudScenario({ profileId: profile.id, run });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "シナリオを確定できませんでした。",
    );
    redirect(
      `/dashboard/scenarios/${encodeURIComponent(runId)}?error=${encodeURIComponent(message)}`,
    );
  }
  redirect(`/dashboard/scenarios/${runId}?message=シナリオを確定しました`);
}
