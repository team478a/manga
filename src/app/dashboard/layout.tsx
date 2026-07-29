import type { ReactNode } from "react";
import { CloudWorkflowShell } from "@/components/CloudWorkflowShell";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <CloudWorkflowShell researchEnabled={cloudResearchFeatureEnabled()}>
      {children}
    </CloudWorkflowShell>
  );
}

