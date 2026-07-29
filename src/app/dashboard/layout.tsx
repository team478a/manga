import type { ReactNode } from "react";
import { CloudWorkflowShell } from "@/components/CloudWorkflowShell";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const researchEnabled = cloudResearchFeatureEnabled();
  const proposalEnabled = researchEnabled && cloudProposalFeatureEnabled();
  return (
    <CloudWorkflowShell
      proposalEnabled={proposalEnabled}
      researchEnabled={researchEnabled}
      scenarioEnabled={proposalEnabled && cloudScenarioFeatureEnabled()}
    >
      {children}
    </CloudWorkflowShell>
  );
}
