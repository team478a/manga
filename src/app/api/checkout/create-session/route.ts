import { NextResponse } from "next/server";
import { createStripeCheckoutSession } from "@/lib/checkout";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId : "";
  const buyerEmail = typeof body.buyer_email === "string" ? body.buyer_email : "";
  const orderId = typeof body.order_id === "string" ? body.order_id : "";

  if (!productId || !buyerEmail || !orderId) {
    return NextResponse.json({ message: "商品ID、購入者メールアドレス、注文IDが必要です。" }, { status: 400 });
  }

  try {
    const session = await createStripeCheckoutSession({
      orderId,
      productId,
      buyerEmail,
      origin: new URL(request.url).origin
    });
    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe Checkout Sessionの作成に失敗しました。";
    return NextResponse.json({ message }, { status: 500 });
  }
}
