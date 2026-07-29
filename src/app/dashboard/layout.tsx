import type { ReactNode } from "react";
import { CloudWorkflowShell } from "@/components/CloudWorkflowShell";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { cloudMangaFeatureEnabled } from "@/lib/cloud-manga";
import { cloudWorkManagementFeatureEnabled } from "@/lib/cloud-work-management";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const researchEnabled = cloudResearchFeatureEnabled();
  const proposalEnabled = researchEnabled && cloudProposalFeatureEnabled();
  const scenarioEnabled = proposalEnabled && cloudScenarioFeatureEnabled();
  const mangaEnabled = scenarioEnabled && cloudMangaFeatureEnabled();
  return (
    <CloudWorkflowShell
      mangaEnabled={mangaEnabled}
      proposalEnabled={proposalEnabled}
      researchEnabled={researchEnabled}
      scenarioEnabled={scenarioEnabled}
      workManagementEnabled={
        mangaEnabled && cloudWorkManagementFeatureEnabled()
      }
    >
      {children}
    </CloudWorkflowShell>
  );
}
