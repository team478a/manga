import type { ReactNode } from "react";
import { CloudWorkflowShell } from "@/components/CloudWorkflowShell";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const researchEnabled = cloudResearchFeatureEnabled();
  return (
    <CloudWorkflowShell
      proposalEnabled={researchEnabled && cloudProposalFeatureEnabled()}
      researchEnabled={researchEnabled}
    >
      {children}
    </CloudWorkflowShell>
  );
}
