import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function CloudProposalNotFound() {
  return (
    <main className="page max-w-3xl">
      <section className="panel text-center">
        <FileQuestion
          aria-hidden="true"
          className="mx-auto h-8 w-8 text-stone-500"
        />
        <h1 className="mt-3 text-xl font-bold">
          AI企画提案が見つかりません
        </h1>
        <p className="mt-2 text-stone-600">
          URLが不正、削除済み、または表示権限がない可能性があります。
        </p>
        <Link className="button-secondary mt-5" href="/dashboard/research">
          市場分析履歴へ
        </Link>
      </section>
    </main>
  );
}
