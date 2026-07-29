"use server";

import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import {
  cloudMangaFeatureEnabled,
  runCloudMangaPlan,
} from "@/lib/cloud-manga";
import { createCloudMangaGeneration } from "@/lib/cloud-manga-server";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { getCloudProposalSelectionById } from "@/lib/cloud-proposal-server";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { getCloudScenarioConfirmationById } from "@/lib/cloud-scenario-server";
import { PermissionDeniedError } from "@/lib/domain-errors";

function assertEnabled() {
  if (
    !cloudResearchFeatureEnabled() ||
    !cloudProposalFeatureEnabled() ||
    !cloudScenarioFeatureEnabled() ||
    !cloudMangaFeatureEnabled()
  )
    throw new PermissionDeniedError(
      "マンガ下書き生成機能は現在停止中です。",
    );
}

export async function createCloudMangaAction(formData: FormData) {
  const confirmationId = String(formData.get("confirmationId") ?? "");
  let generationId: string;
  try {
    assertEnabled();
    const { profile } = await requireProfile();
    const confirmation = await getCloudScenarioConfirmationById(
      profile.id,
      confirmationId,
    );
    const selection = await getCloudProposalSelectionById(
      profile.id,
      confirmation.proposal_selection_id,
    );
    const report = await getCloudResearchReport(
      profile.id,
      selection.research_report_id,
    );
    const plan = runCloudMangaPlan({
      confirmationId: confirmation.id,
      scenarioRunId: confirmation.scenario_run_id,
      proposalSelectionId: confirmation.proposal_selection_id,
      scenario: confirmation.scenario_snapshot,
      contentClass: report.input.contentClass,
    });
    const saved = await createCloudMangaGeneration({
      confirmationId: confirmation.id,
      result: plan,
    });
    generationId = saved.generation_id;
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "マンガ下書きを生成できませんでした。",
    );
    redirect(
      `/dashboard/scenarios?error=${encodeURIComponent(message)}`,
    );
  }
  redirect(
    `/dashboard/manga/${generationId}?message=${encodeURIComponent("マンガ下書きとCanvas Pageを作成しました")}`,
  );
}
