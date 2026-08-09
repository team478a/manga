"use client";

import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export function ResearchSubmitButton() {
  return (
    <PendingSubmitButton
      className="button w-full bg-violet-700 hover:bg-violet-800"
      pendingLabel="AIが売れ筋を調査しています…"
    >
      どんな作品が売れやすいか調べる
    </PendingSubmitButton>
  );
}
