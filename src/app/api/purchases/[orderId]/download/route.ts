import { NextResponse } from "next/server";
import { z } from "zod";
import { toApiError } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import { createPurchaseDownloadUrl } from "@/lib/purchases";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { profile } = await requireProfile();
  try {
    const parsedOrderId = z.string().uuid().safeParse((await params).orderId);
    if (!parsedOrderId.success)
      throw new ResourceNotFoundError("注文が見つかりません。");
    const signedUrl = await createPurchaseDownloadUrl({
      orderId: parsedOrderId.data,
      buyerProfileId: profile.id,
    });
    return NextResponse.redirect(signedUrl, 303);
  } catch (error) {
    const response = toApiError(
      error,
      "購入済みファイルを準備できませんでした。",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
