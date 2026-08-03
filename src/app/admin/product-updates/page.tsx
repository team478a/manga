import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { changeProductUpdateStateAction, createProductUpdateAction } from "./actions";

type ProductUpdate = {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  category: "release" | "improvement" | "fix" | "maintenance";
  action_url: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
};

const categoryLabels = {
  release: "新機能",
  improvement: "改善",
  fix: "不具合修正",
  maintenance: "メンテナンス",
} as const;

export default async function ProductUpdatesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  await requireAdmin();
  const { error, message } = await searchParams;
  const result = await createAdminClient()
    .from("cloud_product_updates")
    .select("id,title,summary,details,category,action_url,published_at,archived_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<ProductUpdate[]>();

  return (
    <main className="page max-w-5xl">
      <Link className="text-sm font-semibold text-violet-700" href="/admin">← 管理者ダッシュボード</Link>
      <h1 className="mt-3 text-3xl font-bold">更新情報</h1>
      <p className="mt-2 text-stone-600">モニターのダッシュボードへ表示する新機能・改善・修正情報を管理します。</p>
      {error ? <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{error}</p> : null}
      {message ? <p className="mt-5 rounded-xl bg-green-50 p-4 text-green-800" role="status">{message}</p> : null}
      {result.error ? (
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-950" role="alert">
          更新情報用migrationが未適用です。適用後に再読み込みしてください。
        </p>
      ) : null}

      <form action={createProductUpdateAction} className="panel mt-6 space-y-4">
        <h2 className="text-xl font-bold">更新情報を追加</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="update-title">タイトル</label>
            <input className="field" id="update-title" maxLength={120} name="title" required />
          </div>
          <div>
            <label className="label" htmlFor="update-category">種類</label>
            <select className="field" id="update-category" name="category">
              <option value="release">新機能</option>
              <option value="improvement">改善</option>
              <option value="fix">不具合修正</option>
              <option value="maintenance">メンテナンス</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="update-action-url">関連画面（任意）</label>
            <input className="field" id="update-action-url" maxLength={500} name="actionUrl" placeholder="/dashboard/research" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="update-summary">短い説明</label>
            <textarea className="field min-h-24" id="update-summary" maxLength={500} name="summary" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="update-details">詳しい説明（任意）</label>
            <textarea className="field min-h-32" id="update-details" maxLength={5000} name="details" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input name="publishNow" type="checkbox" />
          保存と同時に公開する
        </label>
        <PendingSubmitButton className="button bg-violet-700 hover:bg-violet-800" pendingLabel="保存中…">
          更新情報を保存
        </PendingSubmitButton>
      </form>

      <section className="mt-7 space-y-3">
        <h2 className="text-xl font-bold">登録済み</h2>
        {(result.data ?? []).map((item) => (
          <article className="panel" key={item.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-violet-700">{categoryLabels[item.category]}</p>
                <h3 className="mt-1 break-words text-xl font-bold">{item.title}</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-stone-700">{item.summary}</p>
                <p className="mt-2 text-xs text-stone-500">
                  {item.archived_at ? "アーカイブ済み" : item.published_at ? `公開中・${new Date(item.published_at).toLocaleString("ja-JP")}` : "下書き"}
                </p>
              </div>
              {!item.archived_at ? (
                <div className="flex flex-wrap gap-2">
                  <form action={changeProductUpdateStateAction}>
                    <input name="updateId" type="hidden" value={item.id} />
                    <input name="operation" type="hidden" value={item.published_at ? "unpublish" : "publish"} />
                    <PendingSubmitButton className="button-secondary" pendingLabel="更新中…">
                      {item.published_at ? "非公開にする" : "公開する"}
                    </PendingSubmitButton>
                  </form>
                  <form action={changeProductUpdateStateAction}>
                    <input name="updateId" type="hidden" value={item.id} />
                    <input name="operation" type="hidden" value="archive" />
                    <PendingSubmitButton className="button-secondary text-red-700" pendingLabel="処理中…">
                      アーカイブ
                    </PendingSubmitButton>
                  </form>
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {!result.data?.length && !result.error ? <p className="panel text-stone-600">更新情報はまだありません。</p> : null}
      </section>
    </main>
  );
}
