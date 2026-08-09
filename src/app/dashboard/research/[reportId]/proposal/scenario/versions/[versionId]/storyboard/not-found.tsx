import Link from "next/link";
import {
  AsyncStatePage,
  AsyncStatePanel,
} from "@/components/AsyncStateShell";

export default function NotFound() {
  return (
    <AsyncStatePage className="max-w-3xl">
      <AsyncStatePanel className="text-center">
        <h1 className="text-2xl font-bold">採用シナリオが見つかりません</h1>
        <p className="mt-2 text-stone-600">
          シナリオを採用してからネーム生成へ進んでください。
        </p>
        <Link className="button-secondary mt-5" href="/dashboard/research">
          市場分析へ戻る
        </Link>
      </AsyncStatePanel>
    </AsyncStatePage>
  );
}
