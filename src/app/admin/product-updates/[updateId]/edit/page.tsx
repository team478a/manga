import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { editProductUpdateAction } from "../../actions";

type EditableProductUpdate = {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  category: "release" | "improvement" | "fix" | "maintenance";
  action_url: string | null;
};

async function loadProductUpdate(updateId: string) {
  try {
    const result = await createAdminClient()
      .from("cloud_product_updates")
      .select("id,title,summary,details,category,action_url")
      .eq("id", updateId)
      .is("archived_at", null)
      .maybeSingle<EditableProductUpdate>();

    if (result.error) {
      console.error("[admin/product-updates/edit] query failed", result.error.code);
      return { update: null, unavailable: true };
    }
    return { update: result.data, unavailable: false };
  } catch (error) {
    console.error(
      "[admin/product-updates/edit] connection failed",
      error instanceof Error ? error.name : "unknown",
    );
    return { update: null, unavailable: true };
  }
}

export default async function ProductUpdateEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ updateId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { updateId } = await params;
  if (!z.string().uuid().safeParse(updateId).success) notFound();
  const [{ error }, { update, unavailable }] = await Promise.all([
    searchParams,
    loadProductUpdate(updateId),
  ]);

  if (!unavailable && !update) notFound();

  return (
    <main className="page max-w-3xl">
      <Link className="text-sm font-semibold text-violet-700" href="/admin/product-updates">
        ← 更新情報へ戻る
      </Link>
      <h1 className="mt-3 text-3xl font-bold">更新情報を編集</h1>
      <p className="mt-2 text-stone-600">公開中の内容も保存後すぐにダッシュボードへ反映されます。</p>
      {error ? <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{error}</p> : null}
      {unavailable || !update ? (
        <div className="panel mt-6">
          <h2 className="text-xl font-bold">編集内容を読み込めませんでした</h2>
          <p className="mt-2 text-stone-700">時間をおいて再読み込みするか、更新情報の一覧へ戻ってください。</p>
        </div>
      ) : (
        <form action={editProductUpdateAction} className="panel mt-6 space-y-4">
          <input name="updateId" type="hidden" value={update.id} />
          <div>
            <label className="label" htmlFor="update-title">タイトル</label>
            <input className="field" defaultValue={update.title} id="update-title" maxLength={120} name="title" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="update-category">種類</label>
              <select className="field" defaultValue={update.category} id="update-category" name="category">
                <option value="release">新機能</option>
                <option value="improvement">改善</option>
                <option value="fix">不具合修正</option>
                <option value="maintenance">メンテナンス</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="update-action-url">関連画面（任意）</label>
              <input className="field" defaultValue={update.action_url ?? ""} id="update-action-url" maxLength={500} name="actionUrl" />
              <p className="mt-1 text-xs text-stone-500">例: /dashboard/research（外部サイトのURLは登録できません）</p>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="update-summary">短い説明</label>
            <textarea className="field min-h-24" defaultValue={update.summary} id="update-summary" maxLength={500} name="summary" required />
          </div>
          <div>
            <label className="label" htmlFor="update-details">詳しい説明（任意）</label>
            <textarea className="field min-h-32" defaultValue={update.details ?? ""} id="update-details" maxLength={5000} name="details" />
          </div>
          <div className="flex flex-wrap gap-3">
            <PendingSubmitButton className="button bg-violet-700 hover:bg-violet-800" pendingLabel="保存中…">
              変更を保存
            </PendingSubmitButton>
            <Link className="button-secondary" href="/admin/product-updates">キャンセル</Link>
          </div>
        </form>
      )}
    </main>
  );
}
