import Link from "next/link";
import { FileQuestion } from "lucide-react";
import {
  AsyncStatePage,
  AsyncStatePanel,
} from "@/components/AsyncStateShell";

export default function CloudResearchNotFound() {
  return (
    <AsyncStatePage className="max-w-3xl">
      <AsyncStatePanel className="text-center">
        <FileQuestion className="mx-auto h-8 w-8 text-stone-500" />
        <h1 className="mt-3 text-xl font-bold">
          市場分析レポートが見つかりません
        </h1>
        <p className="mt-2 text-stone-600">
          削除済み、URLが不正、または表示権限がない可能性があります。
        </p>
        <Link className="button-secondary mt-5" href="/dashboard/research">
          市場分析履歴へ
        </Link>
      </AsyncStatePanel>
    </AsyncStatePage>
  );
}
