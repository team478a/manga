"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  AsyncStateActions,
  AsyncStatePage,
  AsyncStatePanel,
} from "@/components/AsyncStateShell";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] render failure", error.digest ?? error.name);
  }, [error]);

  return (
    <AsyncStatePage className="max-w-5xl">
      <p className="text-sm font-semibold text-violet-700">管理画面</p>
      <h1 className="mt-2 text-3xl font-bold">管理画面を読み込めませんでした</h1>
      <AsyncStatePanel className="mt-6">
        <p className="text-stone-700">
          一時的な接続エラーが発生しました。操作内容は変更されていません。
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
