import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { SalesPackageImport } from "./SalesPackageImport";

export default async function ImportPackagePage() {
  await requireProfile();
  return (
    <main className="page max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Desktop販売パッケージを確認</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-stone-600">
            MANGAI
            Desktopで書き出したZIPをブラウザ内で検証します。この段階ではファイルをサーバーへ送信せず、作品や商品も作成しません。
          </p>
          <p className="mt-3 max-w-3xl rounded-md bg-amber-50 p-4 text-amber-900">
            Cloudへ取り込めるのは一般漫画の販売パッケージだけです。成人向けパッケージは送信前に拒否されます。
          </p>
        </div>
        <Link className="button-secondary" href="/dashboard">
          マイページへ戻る
        </Link>
      </div>
      <SalesPackageImport />
    </main>
  );
}
