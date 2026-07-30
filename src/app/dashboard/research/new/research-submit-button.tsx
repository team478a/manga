"use client";

import { useFormStatus } from "react-dom";

export function ResearchSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-disabled={pending}
      className="button w-full bg-violet-700 hover:bg-violet-800 disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? "AIが売れ筋を調査しています…" : "どんな作品が売れやすいか調べる"}
    </button>
  );
}
