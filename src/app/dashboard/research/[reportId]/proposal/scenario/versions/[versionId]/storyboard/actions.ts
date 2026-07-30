"use server";
import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { getCloudScenarioVersion, getLatestCloudScenarioAdoption } from "@/lib/cloud-scenario-server";
import { cloudStoryboardFeatureEnabled } from "@/lib/cloud-storyboard";
import { runCloudStoryboardAi } from "@/lib/cloud-storyboard-ai";
import { adoptCloudStoryboard, createCloudStoryboardVersion, getCloudStoryboardVersion, getLatestCloudStoryboardAdoption } from "@/lib/cloud-storyboard-server";
import { cloudStoryboardCanvasFeatureEnabled } from "@/lib/cloud-storyboard-materialization";
import { materializeCloudStoryboard } from "@/lib/cloud-storyboard-materialization-server";
import { enforceCloudStoryboardAiRateLimit } from "@/lib/cloud-research-search-rate-limit";
import { PermissionDeniedError, ResourceNotFoundError } from "@/lib/domain-errors";

function enabled() {
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled() || !cloudScenarioFeatureEnabled() || !cloudStoryboardFeatureEnabled())
    throw new PermissionDeniedError("AIネーム生成機能は現在停止中です。");
}
async function adoptedScenario(profileId: string, reportId: string, scenarioVersionId: string) {
  const scenario = await getCloudScenarioVersion(profileId, scenarioVersionId);
  if (scenario.research_report_id !== reportId) throw new ResourceNotFoundError("採用シナリオが見つかりません。");
  if (scenario.content_class !== "general")
    throw new PermissionDeniedError("成人向けAIネーム生成は現在準備中です。");
  const adoption = await getLatestCloudScenarioAdoption(profileId, scenario.proposal_selection_id);
  if (adoption?.scenario_version_id !== scenario.id) throw new PermissionDeniedError("現在の採用シナリオを選んでください。");
  return scenario;
}
export async function createCloudStoryboardAction(reportId: string, scenarioVersionId: string) {
  let storyboardId = "";
  try {
    enabled();
    const { profile } = await requireProfile();
    await enforceCloudStoryboardAiRateLimit(profile.id);
    const [report, scenario] = await Promise.all([
      getCloudResearchReport(profile.id, reportId),
      adoptedScenario(profile.id, reportId, scenarioVersionId),
    ]);
    const result = await runCloudStoryboardAi({ profileId: profile.id, report, scenario });
    storyboardId = await createCloudStoryboardVersion({ profileId: profile.id, scenarioVersionId, result });
  } catch (error) {
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(scenarioVersionId)}/storyboard?error=${encodeURIComponent(safeDomainErrorMessage(error, "ネームを生成できませんでした。"))}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(scenarioVersionId)}/storyboard/versions/${encodeURIComponent(storyboardId)}?message=${encodeURIComponent("初稿ネームを作成しました")}`);
}
export async function reviseCloudStoryboardAction(reportId: string, scenarioVersionId: string, storyboardId: string, formData: FormData) {
  let nextId = "";
  try {
    enabled();
    const { profile } = await requireProfile();
    await enforceCloudStoryboardAiRateLimit(profile.id);
    const [report, scenario, parent] = await Promise.all([
      getCloudResearchReport(profile.id, reportId),
      adoptedScenario(profile.id, reportId, scenarioVersionId),
      getCloudStoryboardVersion(profile.id, storyboardId),
    ]);
    if (parent.scenario_version_id !== scenario.id) throw new ResourceNotFoundError("修正元ネームが見つかりません。");
    const revisionInstruction = String(formData.get("revisionInstruction") ?? "").trim();
    const result = await runCloudStoryboardAi({ profileId: profile.id, report, scenario, parentVersion: parent, revisionInstruction });
    nextId = await createCloudStoryboardVersion({ profileId: profile.id, scenarioVersionId, parentVersionId: parent.id, revisionInstruction, result });
  } catch (error) {
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(scenarioVersionId)}/storyboard/versions/${encodeURIComponent(storyboardId)}?error=${encodeURIComponent(safeDomainErrorMessage(error, "ネームを修正できませんでした。"))}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(scenarioVersionId)}/storyboard/versions/${encodeURIComponent(nextId)}?message=${encodeURIComponent("修正版ネームを作成しました")}`);
}
export async function adoptCloudStoryboardAction(reportId: string, scenarioVersionId: string, storyboardId: string) {
  try {
    enabled();
    const { profile } = await requireProfile();
    await adoptedScenario(profile.id, reportId, scenarioVersionId);
    const version = await getCloudStoryboardVersion(profile.id, storyboardId);
    if (version.scenario_version_id !== scenarioVersionId) throw new ResourceNotFoundError("ネームが見つかりません。");
    await adoptCloudStoryboard(profile.id, version);
  } catch (error) {
    redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(scenarioVersionId)}/storyboard/versions/${encodeURIComponent(storyboardId)}?error=${encodeURIComponent(safeDomainErrorMessage(error, "ネームを採用できませんでした。"))}`);
  }
  redirect(`/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(scenarioVersionId)}/storyboard/versions/${encodeURIComponent(storyboardId)}?message=${encodeURIComponent("このネームを採用しました")}`);
}

export async function materializeCloudStoryboardAction(
  reportId: string,
  scenarioVersionId: string,
  storyboardId: string,
) {
  let projectId = "";
  try {
    enabled();
    if (!cloudStoryboardCanvasFeatureEnabled())
      throw new PermissionDeniedError("Canvas下書き作成機能は現在停止中です。");
    const { profile } = await requireProfile();
    const scenario = await adoptedScenario(profile.id, reportId, scenarioVersionId);
    const [version, adoption] = await Promise.all([
      getCloudStoryboardVersion(profile.id, storyboardId),
      getLatestCloudStoryboardAdoption(profile.id, scenario.id),
    ]);
    if (
      version.scenario_version_id !== scenario.id ||
      adoption?.storyboard_version_id !== version.id
    )
      throw new PermissionDeniedError("現在の採用ネームを選んでください。");
    const result = await materializeCloudStoryboard(version.id);
    projectId = result.project_id;
  } catch (error) {
    redirect(
      `/dashboard/research/${encodeURIComponent(reportId)}/proposal/scenario/versions/${encodeURIComponent(scenarioVersionId)}/storyboard/versions/${encodeURIComponent(storyboardId)}?error=${encodeURIComponent(safeDomainErrorMessage(error, "Canvas下書きを作成できませんでした。"))}`,
    );
  }
  redirect(
    `/creator/${encodeURIComponent(projectId)}?message=${encodeURIComponent("採用ネームからCanvas下書きを作成しました")}`,
  );
}
