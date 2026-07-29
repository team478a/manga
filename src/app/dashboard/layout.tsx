import type { ReactNode } from "react";
import { CloudWorkflowShell } from "@/components/CloudWorkflowShell";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { cloudMangaFeatureEnabled } from "@/lib/cloud-manga";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const researchEnabled = cloudResearchFeatureEnabled();
  const proposalEnabled = researchEnabled && cloudProposalFeatureEnabled();
  const scenarioEnabled = proposalEnabled && cloudScenarioFeatureEnabled();
  return (
    <CloudWorkflowShell
      mangaEnabled={scenarioEnabled && cloudMangaFeatureEnabled()}
      proposalEnabled={proposalEnabled}
      researchEnabled={researchEnabled}
      scenarioEnabled={scenarioEnabled}
    >
      {children}
    </CloudWorkflowShell>
  );
}
