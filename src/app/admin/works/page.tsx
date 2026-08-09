import Image from "next/image";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { dateJa, statusLabel } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type AdminWork = {
  id: string;
  title: string;
  image_url: string | null;
  status: string;
  is_public: boolean;
  created_at: string;
  profiles: { display_name: string } | null;
};

export default async function AdminWorksPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: works } = await supabase
    .from("works")
    .select("id,title,image_url,status,is_public,created_at,profiles:creator_id(display_name)")
    .order("created_at", { ascending: false })
    .returns<AdminWork[]>();

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">全作品管理</h1>
      <p className="mt-3 text-lg text-stone-600">すべての作品を確認できます。削除機能はまだ実装していません。</p>
      <div className="mt-6 grid gap-4">
        {works?.map((work) => (
          <article className="panel grid gap-4 sm:grid-cols-[150px_1fr_auto] sm:items-center" key={work.id}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-linen">
              {work.image_url ? (
                <Image src={work.image_url} alt={work.title} fill className="object-cover" sizes="150px" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-stone-500">画像なし</div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{work.title}</h2>
              <p className="mt-2 text-stone-600">クリエイター：{work.profiles?.display_name ?? "不明"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge className="text-sm">{work.is_public ? "公開" : "非公開"}</StatusBadge>
                <StatusBadge className="text-sm">{statusLabel(work.status)}</StatusBadge>
                <span className="rounded-full bg-linen px-3 py-1 text-sm">作成日：{dateJa(work.created_at)}</span>
              </div>
            </div>
            <Link className="button-secondary whitespace-nowrap" href={`/works/${work.id}`}>
              詳細確認
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
