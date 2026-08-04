import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeDesktopDevice } from "./actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

type Device = {
  id: string;
  device_name: string;
  approved_at: string | null;
  last_used_at: string | null;
  token_expires_at: string | null;
};

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const admin = createAdminClient();
  const { data } = await admin
    .from("desktop_device_authorizations")
    .select("id, device_name, approved_at, last_used_at, token_expires_at")
    .eq("profile_id", profile.id)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .returns<Device[]>();
  return (
    <main className="page max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Desktop端末認証</h1>
          <p className="mt-3 text-lg text-stone-600">
            MANGAI Desktopに許可した読み取り専用アクセスを管理します。
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="button" href="/dashboard/devices/authorize">
            コードを承認
          </Link>
          <Link className="button-secondary" href="/dashboard">
            マイページへ戻る
          </Link>
        </div>
      </div>
      {params.message ? (
        <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">
          {params.message}
        </p>
      ) : null}
      {params.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">
          {params.error}
        </p>
      ) : null}
      <section className="mt-8 space-y-4">
        {data?.length ? (
          data.map((device) => (
            <article
              className="panel flex flex-col gap-4 sm:flex-row sm:items-center"
              key={device.id}
            >
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold">{device.device_name}</h2>
                <p className="mt-2 text-stone-600">
                  認証:{" "}
                  {device.approved_at
                    ? new Date(device.approved_at).toLocaleString("ja-JP")
                    : "-"}
                  {device.last_used_at
                    ? `・最終利用: ${new Date(device.last_used_at).toLocaleString("ja-JP")}`
                    : ""}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  有効期限:{" "}
                  {device.token_expires_at
                    ? new Date(device.token_expires_at).toLocaleString("ja-JP")
                    : "-"}
                </p>
              </div>
              <form action={revokeDesktopDevice}>
                <input name="id" type="hidden" value={device.id} />
                <PendingSubmitButton className="button-secondary" pendingLabel="解除中…">
                  認証を解除
                </PendingSubmitButton>
              </form>
            </article>
          ))
        ) : (
          <div className="panel text-stone-600">
            認証済みDesktop端末はありません。
          </div>
        )}
      </section>
    </main>
  );
}
