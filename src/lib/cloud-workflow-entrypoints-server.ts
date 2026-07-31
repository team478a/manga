import { getCloudProposalSelection } from "./cloud-proposal-server.ts";
import { listCloudResearchReports } from "./cloud-research-server.ts";
import { getLatestCloudScenarioAdoption } from "./cloud-scenario-server.ts";

export type CloudWorkflowStage = "proposal" | "scenario" | "storyboard";

export type CloudWorkflowEntry = {
  href: string;
  prerequisite: "research" | "proposal" | "scenario" | null;
};

export async function resolveCloudWorkflowEntry(
  profileId: string,
  stage: CloudWorkflowStage,
): Promise<CloudWorkflowEntry> {
  const reports = (await listCloudResearchReports(profileId))
    .filter((report) => report.input.contentClass === "general")
    .slice(0, 20);
  const latestReport = reports[0];

  if (!latestReport) {
    return { href: "/dashboard/research/new", prerequisite: "research" };
  }
  if (stage === "proposal") {
    return {
      href: `/dashboard/research/${latestReport.id}/proposal`,
      prerequisite: null,
    };
  }

  const selections = await Promise.all(
    reports.map(async (report) => ({
      report,
      selection: await getCloudProposalSelection(profileId, report.id),
    })),
  );
  const selected = selections.find((item) => item.selection);
  if (!selected?.selection) {
    return {
      href: `/dashboard/research/${latestReport.id}/proposal`,
      prerequisite: "proposal",
    };
  }
  if (stage === "scenario") {
    return {
      href: `/dashboard/research/${selected.report.id}/proposal/scenario`,
      prerequisite: null,
    };
  }

  const adoption = await getLatestCloudScenarioAdoption(
    profileId,
    selected.selection.id,
  );
  if (!adoption) {
    return {
      href: `/dashboard/research/${selected.report.id}/proposal/scenario`,
      prerequisite: "scenario",
    };
  }
  return {
    href: `/dashboard/research/${selected.report.id}/proposal/scenario/versions/${adoption.scenario_version_id}/storyboard`,
    prerequisite: null,
  };
}
