import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getMyCloudAiQuota } from "@/lib/cloud-creator-server";
import { createClient } from "@/lib/supabase/server";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: entitlement }, quota] = await Promise.all([
    supabase
      .from("cloud_ai_entitlements")
      .select("source,status,stripe_customer_id")
      .eq("profile_id", profile.id)
      .single(),
    getMyCloudAiQuota().catch(() => null),
  ]);
  const remaining = quota
    ? Math.max(
        0,
        quota.credits_limit - quota.credits_used - quota.credits_reserved,
      )
    : 0;
  return (
    <main className="page max-w-4xl">
      <Link className="text-leaf underline" href="/dashboard">
        ← マイページ
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Cloud AIプラン・利用枠</h1>
      <p className="mt-2 text-stone-600">
        creditとProvider原価の両方を生成前に予約し、上限を超える要求は送信しません。
      </p>
      {params.message ? (
        <p className="mt-5 rounded bg-green-50 p-4 text-green-800">
          {params.message}
        </p>
      ) : null}
      {params.error ? (
        <p className="mt-5 rounded bg-red-50 p-4 text-red-700">
          {params.error}
        </p>
      ) : null}
      <section className="panel mt-6 p-6">
        {quota ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-stone-500">現在のプラン</p>
                <p className="mt-1 text-2xl font-bold">
                  {quota.plan_key.toUpperCase()}
                </p>
                <p className="text-sm">{quota.entitlement_status}</p>
              </div>
              <div>
                <p className="text-sm text-stone-500">残りcredit</p>
                <p className="mt-1 text-2xl font-bold">{remaining}</p>
                <p className="text-sm">上限 {quota.credits_limit}</p>
              </div>
              <div>
                <p className="text-sm text-stone-500">使用／予約</p>
                <p className="mt-1 text-2xl font-bold">
                  {quota.credits_used} / {quota.credits_reserved}
                </p>
                <p className="text-sm">
                  期間終了{" "}
                  {new Date(quota.period_ends_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
            </div>
            {!quota.generation_enabled ? (
              <p className="mt-5 rounded bg-yellow-50 p-3 text-yellow-800">
                現在、Cloud
                AI生成は運用設定により停止中です。編集・保存・書き出しは利用できます。
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-red-700">利用枠を安全に確認できません。</p>
        )}
      </section>
      <section className="panel mt-6 p-6">
        <h2 className="text-xl font-bold">Creatorプラン</h2>
        <p className="mt-2 text-stone-600">
          月間1,000 credit。金額と請求周期はStripe
          Checkoutで確定前に表示されます。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {entitlement?.source === "stripe" &&
          entitlement.stripe_customer_id ? (
            <form action="/api/billing/portal" method="post">
              <button className="button" type="submit">
                請求・解約を管理
              </button>
            </form>
          ) : (
            <form action="/api/billing/checkout" method="post">
              <button className="button" type="submit">
                Stripeで申し込む
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
