import {
  DomainError,
  isDomainError,
  ResourceNotFoundError,
  RevisionConflictError,
  StorageTransactionError,
} from "@/lib/domain-errors";
import { createAdminClient } from "@/lib/supabase/admin";

type PurchaseDownload = {
  id: string;
  digital_products: { file_url: string | null } | null;
};

export async function createPurchaseDownloadUrl({
  orderId,
  buyerProfileId,
}: {
  orderId: string;
  buyerProfileId: string;
}) {
  try {
    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,digital_products:product_id(file_url)")
      .eq("id", orderId)
      .eq("buyer_profile_id", buyerProfileId)
      .eq("status", "paid")
      .maybeSingle<PurchaseDownload>();
    if (orderError)
      throw new DomainError(
        "INTERNAL_ERROR",
        "購入情報を確認できませんでした。",
        { cause: orderError },
      );
    if (!order?.digital_products?.file_url)
      throw new ResourceNotFoundError(
        "購入済みファイルを確認できません。",
      );

    const { data: signedUrl, error: signedUrlError } = await admin.storage
      .from("digital-products")
      .createSignedUrl(order.digital_products.file_url, 300, {
        download: true,
      });
    if (signedUrlError || !signedUrl?.signedUrl)
      throw new StorageTransactionError(
        "ダウンロードURLを作成できませんでした。",
      );

    const { data: recorded, error: recordError } = await admin.rpc(
      "record_order_download",
      { p_order_id: order.id, p_buyer_profile_id: buyerProfileId },
    );
    if (recordError)
      throw new DomainError(
        "INTERNAL_ERROR",
        "ダウンロード履歴を記録できませんでした。",
        { cause: recordError },
      );
    if (!recorded)
      throw new RevisionConflictError(
        "購入状態が変更されました。購入履歴を再読込してください。",
      );

    return signedUrl.signedUrl;
  } catch (error) {
    if (isDomainError(error)) throw error;
    throw new DomainError(
      "INTERNAL_ERROR",
      "購入済みファイルを準備できませんでした。",
      { cause: error },
    );
  }
}
