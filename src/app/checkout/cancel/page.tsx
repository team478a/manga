import Link from "next/link";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function CheckoutCancelPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const params = await searchParams;
  let message = "決済はキャンセルされました。";

  if (params.order_id) {
    if (hasSupabaseAdminEnv()) {
      const supabase = createAdminClient();
      const { error } = await supabase.from("orders").update({ status: "canceled" }).eq("id", params.order_id).eq("status", "pending");
      message = error ? "決済はキャンセルされましたが、注文状態の更新に失敗しました。" : "決済はキャンセルされ、仮注文をキャンセル状態にしました。";
    } else {
      message = "決済はキャンセルされました。注文状態の更新にはSUPABASE_SERVICE_ROLE_KEYが必要です。";
    }
  }

  return (
    <main className="page max-w-2xl">
      <section className="panel text-center">
        <p className="text-base font-semibold text-rose">キャンセル</p>
        <h1 className="mt-3 text-3xl font-bold">購入手続きがキャンセルされました</h1>
        <p className="mt-4 text-lg leading-relaxed text-stone-600">{message}</p>
        {params.order_id ? <p className="mt-4 text-sm text-stone-500">注文ID: {params.order_id}</p> : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link className="button" href="/works">作品を探す</Link>
          <Link className="button-secondary" href="/">トップへ戻る</Link>
        </div>
      </section>
    </main>
  );
}
