import { NextResponse } from "next/server";
import { createStripeCheckoutSession } from "@/lib/checkout";
import { toMessageApiError } from "@/lib/api-errors";
import { ValidationError } from "@/lib/domain-errors";
import { z } from "zod";

const checkoutSchema = z.object({
  productId: z.string().uuid(),
  buyer_email: z.string().trim().email().max(254),
  order_id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const parsed = checkoutSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      throw new ValidationError(
        "商品ID、購入者メールアドレス、注文IDが必要です。",
      );
    const session = await createStripeCheckoutSession({
      orderId: parsed.data.order_id,
      productId: parsed.data.productId,
      buyerEmail: parsed.data.buyer_email,
      origin: new URL(request.url).origin,
    });
    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    const response = toMessageApiError(
      error,
      "Stripe Checkout Sessionの作成に失敗しました。",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
