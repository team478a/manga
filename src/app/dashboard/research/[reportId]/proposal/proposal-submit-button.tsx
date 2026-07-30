"use client";

import { useFormStatus } from "react-dom";

export function ProposalSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-disabled={pending}
      className="button mt-5 bg-violet-700 hover:bg-violet-800 disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? "AIが企画を作成中…" : "AI企画を3案作成"}
    </button>
  );
}
