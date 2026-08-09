import Image from "next/image";
import { updateGoodsRequestAdmin } from "@/app/actions";
import { StatusBadge } from "@/components/StatusBadge";
import { dateJa, statusLabel } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type AdminGoodsRequest = {
  id: string;
  product_type: string;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  works: { title: string; image_url: string | null } | null;
  profiles: { display_name: string } | null;
};

const statuses = [
  { value: "pending", label: "pending / 受付済み" },
  { value: "approved", label: "approved / 承認" },
  { value: "rejected", label: "rejected / 見送り" },
  { value: "in_progress", label: "in_progress / 対応中" },
  { value: "completed", label: "completed / 対応完了" }
];

export default async function AdminGoodsRequestsPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("goods_requests")
    .select("id,product_type,note,status,admin_note,created_at,works:work_id(title,image_url),profiles:creator_id(display_name)")
    .order("created_at", { ascending: false })
    .returns<AdminGoodsRequest[]>();

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">グッズ申請管理</h1>
      <p className="mt-3 text-lg leading-relaxed text-stone-600">
        全クリエイターのグッズ販売申請を確認し、手動対応の進行状況と管理者メモを更新できます。
      </p>
      {params.message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">{params.message}</p> : null}
      {params.error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{params.error}</p> : null}

      <div className="mt-6 grid gap-5">
        {requests?.length ? requests.map((request) => (
          <article className="panel grid gap-5 lg:grid-cols-[180px_1fr]" key={request.id}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-linen">
              {request.works?.image_url ? (
                <Image src={request.works.image_url} alt={request.works.title} fill className="object-cover" sizes="180px" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-stone-500">画像なし</div>
              )}
            </div>
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{request.works?.title ?? "作品不明"}</h2>
                  <p className="mt-2 text-stone-700">クリエイター：{request.profiles?.display_name ?? "不明"}</p>
                  <p className="mt-1 text-stone-700">希望商品タイプ：{request.product_type}</p>
                  <p className="mt-1 text-sm text-stone-500">申請日：{dateJa(request.created_at)}</p>
                </div>
                <StatusBadge className="w-fit text-sm">{statusLabel(request.status)}</StatusBadge>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-md border border-stone-200 p-4">
                  <p className="font-semibold">申請メモ</p>
                  <p className="mt-2 whitespace-pre-wrap text-stone-700">{request.note || "連絡事項なし"}</p>
                </div>
                <form action={updateGoodsRequestAdmin} className="rounded-md border border-stone-200 p-4">
                  <input name="id" type="hidden" value={request.id} />
                  <div>
                    <label className="label" htmlFor={`status-${request.id}`}>状態変更</label>
                    <select className="field" id={`status-${request.id}`} name="status" defaultValue={request.status}>
                      {statuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4">
                    <label className="label" htmlFor={`adminNote-${request.id}`}>管理者メモ</label>
                    <textarea className="field min-h-28" id={`adminNote-${request.id}`} name="adminNote" defaultValue={request.admin_note ?? ""} />
                  </div>
                  <button className="button mt-4 w-full" type="submit">更新する</button>
                </form>
              </div>
            </div>
          </article>
        )) : (
          <div className="panel text-center">
            <h2 className="text-2xl font-bold">申請はまだありません</h2>
            <p className="mt-3 text-lg text-stone-600">クリエイターから申請が届くと、ここに表示されます。</p>
          </div>
        )}
      </div>
    </main>
  );
}
