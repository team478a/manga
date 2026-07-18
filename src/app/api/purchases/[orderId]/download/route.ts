import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Purchase = {
  id: string;
  digital_products: { file_url: string | null } | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { profile } = await requireProfile();
  const parsedOrderId = z.string().uuid().safeParse((await params).orderId);
  if (!parsedOrderId.success)
    return NextResponse.json({ error: "注文が見つかりません。" }, { status: 404 });
  const orderId = parsedOrderId.data;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,digital_products:product_id(file_url)")
    .eq("id", orderId)
    .eq("buyer_profile_id", profile.id)
    .eq("status", "paid")
    .maybeSingle<Purchase>();
  if (!order?.digital_products?.file_url)
    return NextResponse.json(
      { error: "購入済みファイルを確認できません。" },
      { status: 404 },
    );
  const { data, error } = await admin.storage
    .from("digital-products")
    .createSignedUrl(order.digital_products.file_url, 300, { download: true });
  if (error || !data?.signedUrl)
    return NextResponse.json(
      { error: "ダウンロードURLを作成できません。" },
      { status: 500 },
    );
  const { data: recorded, error: recordError } = await admin.rpc(
    "record_order_download",
    { p_order_id: order.id, p_buyer_profile_id: profile.id },
  );
  if (recordError || !recorded)
    return NextResponse.json(
      { error: "ダウンロード履歴を記録できません。" },
      { status: 409 },
    );
  return NextResponse.redirect(data.signedUrl, 303);
}
