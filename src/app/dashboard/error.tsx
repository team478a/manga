"use client";

import Link from "next/link";
import {
  AsyncStateActions,
  AsyncStatePage,
  AsyncStatePanel,
} from "@/components/AsyncStateShell";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <AsyncStatePage className="max-w-3xl">
      <p className="font-semibold text-violet-700">MANGAI Cloud</p>
      <h1 className="mt-2 text-3xl font-bold">ダッシュボードを読み込めませんでした</h1>
      <AsyncStatePanel className="mt-6" role="alert">
        <h2 className="text-xl font-bold">操作内容は失われていません</h2>
        <p className="mt-3 text-stone-600">
          一時的に情報を取得できませんでした。もう一度読み込むか、モニター状況をご確認ください。
        </p>
      </AsyncStatePanel>
      <AsyncStateActions className="mt-6 flex-col gap-3 sm:flex-row">
        <button className="button bg-violet-700 hover:bg-violet-800" onClick={reset} type="button">
          もう一度読み込む
        </button>
        <Link className="button-secondary" href="/dashboard/monitor">モニター状況を確認</Link>
      </AsyncStateActions>
    </AsyncStatePage>
  );
}
