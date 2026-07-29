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
      {pending ? "AIが市場を分析しています…" : "AIで市場分析を実行して保存"}
    </button>
  );
}
