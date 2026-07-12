import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { dateJa, statusLabel } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AdminUser = {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  role: string;
  created_at: string;
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: user } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle<AdminUser>();

  if (!user) notFound();

  let email = "未取得";
  if (hasSupabaseAdminEnv()) {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(user.user_id);
    email = data.user?.email ?? "未設定";
  }

  return (
    <main className="page max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">ユーザー詳細</h1>
          <p className="mt-3 text-lg text-stone-600">登録情報を確認できます。編集・削除機能はまだ実装していません。</p>
        </div>
        <Link className="button-secondary" href="/admin/users">一覧へ戻る</Link>
      </div>
      <section className="panel mt-6 space-y-4">
        <div>
          <p className="text-sm text-stone-500">表示名</p>
          <p className="text-2xl font-bold">{user.display_name || "未設定"}</p>
        </div>
        <div>
          <p className="text-sm text-stone-500">メールアドレス</p>
          <p className="text-lg">{email}</p>
        </div>
        <div>
          <p className="text-sm text-stone-500">権限</p>
          <span className="mt-2 inline-flex rounded-full bg-linen px-3 py-1 text-sm">{statusLabel(user.role)}</span>
        </div>
        <div>
          <p className="text-sm text-stone-500">登録日</p>
          <p className="text-lg">{dateJa(user.created_at)}</p>
        </div>
        <div>
          <p className="text-sm text-stone-500">自己紹介</p>
          <p className="whitespace-pre-wrap text-lg">{user.bio || "未設定"}</p>
        </div>
      </section>
    </main>
  );
}
