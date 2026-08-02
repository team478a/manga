import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { dateJa, statusLabel } from "@/lib/format";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AdminUserAccountActions } from "./AdminUserAccountActions";

type AdminUser = {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  created_at: string;
};

type AccountState = "active" | "suspended" | "deleted" | "unknown";

type AuthAccount = {
  email: string;
  state: AccountState;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
};

type InviteDelivery = {
  profile_id: string;
  invite_email_sent_at: string | null;
  invite_email_send_count: number;
};

const dateTimeJa = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { user: actorUser } = await requireAdmin();
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const { data: users } = await supabase.from("profiles").select("id,user_id,display_name,role,created_at").order("created_at", { ascending: false }).returns<AdminUser[]>();

  const authByUserId = new Map<string, AuthAccount>();
  const inviteByProfileId = new Map<string, InviteDelivery>();
  let inviteTrackingConfigured = true;
  if (hasSupabaseAdminEnv()) {
    const admin = createAdminClient();
    const [{ data }, inviteResult] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin
        .from("cloud_general_monitor_enrollments")
        .select("profile_id,invite_email_sent_at,invite_email_send_count")
        .returns<InviteDelivery[]>(),
    ]);
    data.users.forEach((user) => {
      const isSuspended = Boolean(user.banned_until);
      authByUserId.set(user.id, {
        email: user.email ?? "",
        state: user.deleted_at ? "deleted" : isSuspended ? "suspended" : "active",
        emailConfirmedAt: user.email_confirmed_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
      });
    });
    inviteTrackingConfigured = !inviteResult.error;
    (inviteResult.data ?? []).forEach((invite) =>
      inviteByProfileId.set(invite.profile_id, invite),
    );
  }

  const visibleUsers = hasSupabaseAdminEnv()
    ? (users ?? []).filter(
        (user) => {
          const account = authByUserId.get(user.user_id);
          return Boolean(account && account.state !== "deleted");
        },
      )
    : (users ?? []);

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">ユーザー管理</h1>
      <p className="mt-3 text-lg text-stone-600">登録ユーザーの確認、利用停止、再開、削除ができます。</p>
      {message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800" role="status">{message}</p> : null}
      {error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700" role="alert">{error}</p> : null}
      {!hasSupabaseAdminEnv() ? (
        <p className="mt-5 rounded-md bg-yellow-50 p-4 text-yellow-800">メールアドレス表示には `SUPABASE_SERVICE_ROLE_KEY` が必要です。</p>
      ) : null}
      {!inviteTrackingConfigured ? (
        <p className="mt-5 rounded-md bg-yellow-50 p-4 text-yellow-800" role="alert">
          招待メールの送信履歴を表示するには、最新のmonitor invite tracking migrationを適用してください。
        </p>
      ) : null}
      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full min-w-[1260px] text-left text-base">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="py-3">表示名</th>
              <th className="py-3">メールアドレス</th>
              <th className="py-3">権限</th>
              <th className="py-3">登録日</th>
              <th className="py-3">招待メール</th>
              <th className="py-3">ログイン</th>
              <th className="py-3">状態</th>
              <th className="py-3">操作</th>
              <th className="py-3">詳細</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user) => {
              const auth = authByUserId.get(user.user_id);
              const invite = inviteByProfileId.get(user.id);
              return (
              <tr className="border-b border-stone-100" key={user.id}>
                <td className="py-3 font-semibold">{user.display_name || "未設定"}</td>
                <td className="py-3">{auth?.email || "未取得"}</td>
                <td className="py-3"><span className="rounded-full bg-linen px-3 py-1 text-sm">{statusLabel(user.role)}</span></td>
                <td className="py-3">{dateJa(user.created_at)}</td>
                <td className="py-3 text-sm">
                  {invite?.invite_email_sent_at ? (
                    <span className="text-green-800">
                      送信済み<br />
                      <span className="text-xs text-stone-500">
                        {dateTimeJa(invite.invite_email_sent_at)}
                        {invite.invite_email_send_count > 1
                          ? `（${invite.invite_email_send_count}回）`
                          : ""}
                      </span>
                    </span>
                  ) : invite ? "未送信" : "対象外"}
                </td>
                <td className="py-3 text-sm">
                  {auth?.lastSignInAt ? (
                    <span>
                      ログイン済み<br />
                      <span className="text-xs text-stone-500">
                        最終 {dateTimeJa(auth.lastSignInAt)}
                      </span>
                    </span>
                  ) : auth?.emailConfirmedAt ? "メール確認済み・未ログイン" : "未ログイン"}
                </td>
                <td className="py-3">
                  {auth?.state === "suspended" ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900">停止中</span>
                  ) : auth?.state === "active" ? (
                    <span className="rounded-full bg-green-50 px-3 py-1 text-sm text-green-800">利用中</span>
                  ) : (
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">未取得</span>
                  )}
                </td>
                <td className="py-3">
                  <AdminUserAccountActions
                    accountState={auth?.state ?? "unknown"}
                    canManage={Boolean(
                      hasSupabaseAdminEnv() &&
                        user.user_id !== actorUser.id &&
                        user.role !== "admin",
                    )}
                    displayName={user.display_name || "未設定のユーザー"}
                    profileId={user.id}
                  />
                </td>
                <td className="py-3"><Link className="text-leaf underline" href={`/admin/users/${user.id}`}>確認</Link></td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
