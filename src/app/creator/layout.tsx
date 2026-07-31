import type { ReactNode } from "react";
import { CloudWorkflowShell } from "@/components/CloudWorkflowShell";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return (
    <CloudWorkflowShell researchEnabled={cloudResearchFeatureEnabled()}>
      <div className="cloud-studio-scope min-h-full">{children}</div>
    </CloudWorkflowShell>
  );
}
