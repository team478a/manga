import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPendingOrder } from "@/app/actions";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { isMarketplaceCanaryCheckoutTarget } from "@/lib/checkout-canary";
import { inspectMarketplaceCheckoutMode } from "@/lib/checkout-mode";
import { yen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type CheckoutProduct = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  status: string;
  creator_id: string;
  profiles: { display_name: string } | null;
  works: {
    id: string;
    title: string;
    image_url: string | null;
    is_public: boolean;
  } | null;
};

export default async function CheckoutPage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ message?: string; error?: string; orderId?: string }>;
}) {
  const { productId } = await params;
  const messages = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: product } = await supabase
    .from("digital_products")
    .select("id,title,description,price,status,creator_id,profiles:creator_id(display_name),works:work_id(id,title,image_url,is_public)")
    .eq("id", productId)
    .maybeSingle<CheckoutProduct>();

  if (!product) notFound();

  const checkout = inspectMarketplaceCheckoutMode();
  let buyerProfileId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>();
    buyerProfileId = profile?.id ?? null;
  }
  const productAvailable = product.status === "active" && product.works?.is_public;
  const canPurchase = Boolean(
    productAvailable &&
      checkout.enabled &&
      checkout.paymentMode &&
      isMarketplaceCanaryCheckoutTarget({
        buyerProfileId,
        paymentMode: checkout.paymentMode,
        productId: product.id,
        sellerProfileId: product.creator_id,
      }),
  );

  return (
    <main className="page max-w-5xl">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-linen">
          {product.works?.image_url ? (
            <Image src={product.works.image_url} alt={product.works.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 45vw" />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-500">作品画像なし</div>
          )}
        </div>
        <section className="panel">
          <p className="text-base font-semibold text-leaf">購入準備</p>
          <h1 className="mt-2 text-3xl font-bold">{product.title}</h1>
          <p className="mt-3 text-lg text-stone-600">作品：{product.works?.title ?? "不明"}</p>
          <p className="mt-1 text-lg text-stone-600">クリエイター：{product.profiles?.display_name ?? "不明"}</p>
          <p className="mt-5 text-3xl font-bold">税込 {yen(product.price)}</p>
          <p className="mt-5 whitespace-pre-wrap text-lg leading-relaxed text-stone-700">{product.description || "商品説明はまだありません。"}</p>

          {checkout.paymentMode === "test" ? (
            <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950" role="status">
              <p className="font-bold">テスト販売</p>
              <p className="mt-1 text-sm leading-relaxed">Stripeのテスト環境を使用します。実際のカード請求や出品者への売上計上は行われません。</p>
            </div>
          ) : null}

          {messages.message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">{messages.message}</p> : null}
          {messages.error ? <InlineErrorMessage>{messages.error}</InlineErrorMessage> : null}
          {!productAvailable ? <InlineErrorMessage>この商品は現在購入できません。</InlineErrorMessage> : null}
          {productAvailable && !checkout.enabled ? <InlineErrorMessage>{checkout.reason ?? "購入手続きは現在利用できません。"}</InlineErrorMessage> : null}
          {productAvailable && checkout.enabled && !canPurchase ? <InlineErrorMessage>この商品は現在、指定された購入者だけが購入できます。</InlineErrorMessage> : null}

          <form action={createPendingOrder} className="mt-6 space-y-5">
            <input name="productId" type="hidden" value={product.id} />
            <div>
              <label className="label" htmlFor="buyerEmail">購入者メールアドレス</label>
              <p className="mt-1 text-base text-stone-600">決済やダウンロード案内に使う予定のメールアドレスです。</p>
              <input className="field" id="buyerEmail" name="buyerEmail" type="email" required placeholder="you@example.com" defaultValue={user?.email ?? ""} disabled={!canPurchase} />
              <p className="mt-2 text-sm text-stone-500">
                ログイン中のメールアドレスで購入すると、購入履歴から再ダウンロードできます。
              </p>
            </div>
            <button className="button w-full" type="submit" disabled={!canPurchase}>
              {checkout.paymentMode === "test" ? "テスト購入へ進む" : "購入へ進む"}
            </button>
          </form>

          {messages.orderId ? (
            <p className="mt-4 text-sm text-stone-500">仮注文ID：{messages.orderId}</p>
          ) : null}
          <Link className="mt-5 inline-flex text-leaf underline" href={product.works ? `/works/${product.works.id}` : "/works"}>
            作品ページへ戻る
          </Link>
        </section>
      </div>
    </main>
  );
}
