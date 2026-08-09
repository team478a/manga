"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  AsyncStateActions,
  AsyncStatePage,
  AsyncStatePanel,
} from "@/components/AsyncStateShell";

export default function CloudProposalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AsyncStatePage className="max-w-3xl">
      <AsyncStatePanel className="text-center" role="alert">
        <AlertTriangle
          aria-hidden="true"
          className="mx-auto h-8 w-8 text-red-600"
        />
        <h1 className="mt-3 text-xl font-bold">
          AI企画提案を表示できませんでした
        </h1>
        <p className="mt-2 text-stone-600">
          内部情報は表示していません。時間をおいて再度お試しください。
        </p>
        <AsyncStateActions className="mt-5 flex-col justify-center gap-3 sm:flex-row">
          <button className="button" onClick={reset} type="button">
            再試行
          </button>
          <Link className="button-secondary" href="/dashboard/research">
            市場分析履歴へ
          </Link>
        </AsyncStateActions>
      </AsyncStatePanel>
    </AsyncStatePage>
  );
}
