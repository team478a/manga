"use client";

import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export function ProposalSubmitButton() {
  return (
    <PendingSubmitButton
      className="button mt-5 bg-violet-700 hover:bg-violet-800"
      pendingLabel="AIが企画を作成中…"
    >
      AI企画を3案作成
    </PendingSubmitButton>
  );
}

export function ProposalSelectionButton() {
  return (
    <PendingSubmitButton
      className="button w-full bg-violet-700 hover:bg-violet-800"
      pendingLabel="企画を保存中…"
    >
      この企画で進める
    </PendingSubmitButton>
  );
}
