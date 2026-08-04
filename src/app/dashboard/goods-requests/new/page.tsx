import Link from "next/link";
import { createGoodsRequest } from "@/app/actions";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/lib/types";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

const productTypes = ["Tシャツ", "パーカー", "トートバッグ", "ステッカー", "アクリルスタンド", "ポスター", "マグカップ", "その他"];

export default async function NewGoodsRequestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: works } = await supabase
    .from("works")
    .select("*")
    .eq("creator_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Work[]>();

  return (
    <main className="page max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">グッズ販売申請</h1>
          <p className="mt-3 text-lg leading-relaxed text-stone-600">
            作品を使ったグッズ化について運営に相談できます。印刷会社API連携や自動製造はまだ行わず、運営が手動で内容を確認します。
          </p>
        </div>
        <Link className="button-secondary" href="/dashboard/goods-requests">
          一覧へ戻る
        </Link>
      </div>
      {params.error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{params.error}</p> : null}

      <form action={createGoodsRequest} className="panel mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="workId">紐づける作品</label>
          <p className="mt-1 text-base text-stone-600">自分が登録した作品だけ選べます。</p>
          <select className="field" id="workId" name="workId" required>
            <option value="">選んでください</option>
            {works?.map((work) => (
              <option key={work.id} value={work.id}>
                {work.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="productType">希望商品タイプ</label>
          <select className="field" id="productType" name="productType" required>
            <option value="">選んでください</option>
            {productTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="note">申請メモ</label>
          <p className="mt-1 text-base text-stone-600">希望サイズ、色、販売イメージ、確認してほしい点などを書けます。</p>
          <textarea className="field min-h-40" id="note" name="note" placeholder="例：淡い色のTシャツにしたいです。販売前に印刷イメージを確認したいです。" />
        </div>
        <PendingSubmitButton className="button w-full" pendingLabel="申請を送信中…">申請を送信する</PendingSubmitButton>
      </form>
    </main>
  );
}
