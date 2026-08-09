"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  AsyncStateActions,
  AsyncStatePage,
  AsyncStatePanel,
} from "@/components/AsyncStateShell";

export default function ProductUpdatesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/product-updates] render failed", error.digest ?? error.name);
  }, [error]);

  return (
    <AsyncStatePage className="max-w-5xl">
      <h1 className="text-3xl font-bold">更新情報を読み込めませんでした</h1>
      <AsyncStatePanel as="div" className="mt-6">
        <p className="text-stone-700">
          入力内容は変更されていません。時間をおいて再読み込みするか、管理画面TOPへ戻ってください。
        </p>
        <AsyncStateActions className="mt-5 flex-wrap gap-3">
          <button className="button bg-violet-700 hover:bg-violet-800" onClick={reset} type="button">
            もう一度読み込む
          </button>
          <Link className="button-secondary" href="/admin">
            管理画面TOPへ
          </Link>
        </AsyncStateActions>
      </AsyncStatePanel>
    </AsyncStatePage>
  );
}
