"use client";

import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export function ScenarioSubmitButton({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) {
  return (
    <PendingSubmitButton
      className={secondary ? "button-secondary" : "button bg-violet-700 hover:bg-violet-800"}
      pendingLabel="AIがシナリオを作成中…"
    >
      {children}
    </PendingSubmitButton>
  );
}
