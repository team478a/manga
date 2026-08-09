"use client";

import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export function StoryboardButton({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) {
  return (
    <PendingSubmitButton
      className={secondary ? "button-secondary" : "button bg-violet-700 hover:bg-violet-800"}
      pendingLabel="AIがネームを作成中…"
    >
      {children}
    </PendingSubmitButton>
  );
}
