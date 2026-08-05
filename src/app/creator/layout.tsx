import type { ReactNode } from "react";
import { CloudWorkflowShell } from "@/components/CloudWorkflowShell";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { cloudStoryboardFeatureEnabled } from "@/lib/cloud-storyboard";
import { getCurrentProfile } from "@/lib/auth";

export default async function CreatorLayout({ children }: { children: ReactNode }) {
  const { profile } = await getCurrentProfile();
  const researchEnabled = cloudResearchFeatureEnabled();
  const proposalEnabled = researchEnabled && cloudProposalFeatureEnabled();
  const scenarioEnabled = proposalEnabled && cloudScenarioFeatureEnabled();
  const storyboardEnabled = scenarioEnabled && cloudStoryboardFeatureEnabled();
  return (
    <CloudWorkflowShell
      accountDisplayName={profile?.display_name ?? "表示名未設定"}
      proposalEnabled={proposalEnabled}
      researchEnabled={researchEnabled}
      scenarioEnabled={scenarioEnabled}
      storyboardEnabled={storyboardEnabled}
    >
      <div className="cloud-studio-scope min-h-full">{children}</div>
    </CloudWorkflowShell>
  );
}
