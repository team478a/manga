import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { StatusBadge } from "@/components/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { dateJa, statusLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type GoodsRequestRow = {
  id: string;
  product_type: string;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  works: { title: string } | null;
};

export default async function GoodsRequestsPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("goods_requests")
    .select("id,product_type,note,status,admin_note,created_at,works:work_id(title)")
    .eq("creator_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<GoodsRequestRow[]>();

  return (
    <main className="page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">グッズ販売申請</h1>
          <p className="mt-3 text-lg leading-relaxed text-stone-600">
            グッズ販売申請は、作品をTシャツやポスターなどに展開したいときに運営へ相談する機能です。初期段階では自動製造ではなく、運営が内容を確認して手動で対応します。
          </p>
        </div>
        <Link className="button" href="/dashboard/goods-requests/new">
          申請する
        </Link>
      </div>
      {params.message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">{params.message}</p> : null}
      {params.error ? <InlineErrorMessage>{params.error}</InlineErrorMessage> : null}

      {requests?.length ? (
        <div className="mt-8 grid gap-4">
          {requests.map((request) => (
            <article className="panel" key={request.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{request.product_type}</h2>
                  <p className="mt-2 text-base text-stone-600">紐づく作品：{request.works?.title ?? "不明"}</p>
                  <p className="mt-1 text-sm text-stone-500">申請日：{dateJa(request.created_at)}</p>
                </div>
                <StatusBadge className="w-fit text-sm">{statusLabel(request.status)}</StatusBadge>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-md border border-stone-200 p-4">
                  <p className="font-semibold">申請メモ</p>
                  <p className="mt-2 whitespace-pre-wrap text-stone-700">{request.note || "メモなし"}</p>
                </div>
                <div className="rounded-md border border-stone-200 p-4">
                  <p className="font-semibold">管理者メモ</p>
                  <p className="mt-2 whitespace-pre-wrap text-stone-700">{request.admin_note || "まだ管理者メモはありません。"}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="グッズ販売申請はまだありません"
            body="作品を選んで、作りたいグッズの種類と希望内容を運営へ送れます。"
            href="/dashboard/goods-requests/new"
            action="申請する"
          />
        </div>
      )}
    </main>
  );
}
