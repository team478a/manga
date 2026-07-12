import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const productId = String(formData.get("productId") ?? "");

  // MVPでは雛形のみです。次の実装でSupabaseから商品情報を取得し、
  // Stripe Checkout Session作成、Webhookでorders更新、購入ファイル配布を接続します。
  return NextResponse.json(
    {
      message: "Stripe決済は後続タスクで接続します。現在はAPIルートの雛形です。",
      productId,
      requiredEnv: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_SITE_URL"]
    },
    { status: 501 }
  );
}
