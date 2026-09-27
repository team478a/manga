import Link from "next/link";
import { markCheckoutSessionPaid } from "@/lib/payments";
import { createStripeClient } from "@/lib/stripe";
import { paidSessionReference } from "@/lib/checkout-policy";
import { getPaidCheckoutDownload } from "@/modules/checkout/infrastructure/checkout-order-repository";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  let downloadUrl: string | null = null;
  let productTitle: string | null = null;
  let paymentMode: "test" | "live" | null = null;
  let message =
    "決済情報を確認しています。少し時間をおいて再読み込みしてください。";

  if (sessionId) {
    try {
      const session =
        await createStripeClient().checkout.sessions.retrieve(sessionId);
      const paid = await markCheckoutSessionPaid(session);
      const reference = paid ? paidSessionReference(session) : null;
      if (reference) {
        paymentMode = reference.paymentMode;
        const { order, signedUrl } = await getPaidCheckoutDownload(reference);

        if (order?.digital_products?.file_url) {
          downloadUrl = signedUrl;
          productTitle = order.digital_products.title;
          message = downloadUrl
            ? "決済が確認できました。ダウンロードリンクは5分間有効です。"
            : "決済は完了しましたが、ダウンロードリンクを作成できませんでした。";
        } else {
          message = "決済は完了しましたが、商品ファイルが登録されていません。";
        }
      }
    } catch {
      message =
        "決済情報を確認できませんでした。セッションIDを確認してください。";
    }
  }

  return (
    <main className="page max-w-2xl">
      <section className="panel text-center">
        <p className="text-base font-semibold text-leaf">{paymentMode === "test" ? "テスト決済完了" : "決済完了"}</p>
        <h1 className="mt-3 text-3xl font-bold">購入ありがとうございます</h1>
        {paymentMode === "test" ? <p className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">テスト購入のため、実際の請求・売上・振込は発生しません。</p> : null}
        <p className="mt-4 text-lg leading-relaxed text-stone-600">{message}</p>
        {downloadUrl ? (
          <a className="button mt-6 inline-flex" href={downloadUrl}>
            「{productTitle}」をダウンロード
          </a>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link className="button" href="/works">
            作品を探す
          </Link>
          <Link className="button-secondary" href="/dashboard/purchases">
            購入履歴
          </Link>
          <Link className="button-secondary" href="/">
            トップへ戻る
          </Link>
        </div>
      </section>
    </main>
  );
}
