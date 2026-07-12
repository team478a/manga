import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { dateJa, statusLabel } from "@/lib/format";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AdminUser = {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  created_at: string;
};

export default async function AdminUsersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: users } = await supabase.from("profiles").select("id,user_id,display_name,role,created_at").order("created_at", { ascending: false }).returns<AdminUser[]>();

  const emailByUserId = new Map<string, string>();
  if (hasSupabaseAdminEnv()) {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    data.users.forEach((user) => {
      emailByUserId.set(user.id, user.email ?? "");
    });
  }

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">ユーザー管理</h1>
      <p className="mt-3 text-lg text-stone-600">登録ユーザーの表示名、メールアドレス、権限、登録日を確認できます。</p>
      {!hasSupabaseAdminEnv() ? (
        <p className="mt-5 rounded-md bg-yellow-50 p-4 text-yellow-800">メールアドレス表示には `SUPABASE_SERVICE_ROLE_KEY` が必要です。</p>
      ) : null}
      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-base">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="py-3">表示名</th>
              <th className="py-3">メールアドレス</th>
              <th className="py-3">権限</th>
              <th className="py-3">登録日</th>
              <th className="py-3">詳細</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr className="border-b border-stone-100" key={user.id}>
                <td className="py-3 font-semibold">{user.display_name || "未設定"}</td>
                <td className="py-3">{emailByUserId.get(user.user_id) || "未取得"}</td>
                <td className="py-3"><span className="rounded-full bg-linen px-3 py-1 text-sm">{statusLabel(user.role)}</span></td>
                <td className="py-3">{dateJa(user.created_at)}</td>
                <td className="py-3"><Link className="text-leaf underline" href={`/admin/users/${user.id}`}>確認</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
