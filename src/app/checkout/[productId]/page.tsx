import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPendingOrder } from "@/app/actions";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import {
  isMarketplaceCanaryCheckoutListing,
  isMarketplaceCanaryCheckoutTarget,
} from "@/lib/checkout-canary";
import { inspectMarketplaceCheckoutMode } from "@/lib/checkout-mode";
import { yen } from "@/lib/format";
import {
  publicCreatorName,
  type PublicWorkCreatorAttribution,
} from "@/lib/public-creator-attribution";
import { createClient } from "@/lib/supabase/server";

type CheckoutProduct = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  status: string;
  creator_id: string;
  works: {
    id: string;
    title: string;
    image_url: string | null;
    is_public: boolean;
    content_class: "general" | "adult";
    source_project_id: string | null;
    current_publication_id: string | null;
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
    .select("id,title,description,price,status,creator_id,works:work_id(id,title,image_url,is_public,content_class,source_project_id,current_publication_id)")
    .eq("id", productId)
    .maybeSingle<CheckoutProduct>();

  if (!product) notFound();

  const { data: creatorRows } = product.works
    ? await supabase.rpc("list_public_work_creator_attributions", {
        p_work_ids: [product.works.id],
      })
    : { data: null };
  const creatorName = publicCreatorName(
    creatorRows as PublicWorkCreatorAttribution[] | null,
    product.works?.id,
  );

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
  const productAvailable = Boolean(
    product.status === "active" &&
      product.works?.is_public &&
      product.works.content_class === "general" &&
      (!product.works.source_project_id ||
        product.works.current_publication_id),
  );
  const checkoutEntryAvailable = Boolean(
    productAvailable &&
      checkout.enabled &&
      checkout.paymentMode &&
      isMarketplaceCanaryCheckoutListing({
        paymentMode: checkout.paymentMode,
        productId: product.id,
        sellerProfileId: product.creator_id,
      }),
  );
  const canPurchase = Boolean(
    checkoutEntryAvailable &&
      checkout.paymentMode &&
      isMarketplaceCanaryCheckoutTarget({
        buyerProfileId,
        paymentMode: checkout.paymentMode,
        productId: product.id,
        sellerProfileId: product.creator_id,
      }),
  );
  const loginRequired = Boolean(
    checkoutEntryAvailable &&
      checkout.paymentMode === "live" &&
      !user,
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
          <p className="mt-1 text-lg text-stone-600">クリエイター：{creatorName}</p>
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
          {productAvailable && checkout.enabled && !checkoutEntryAvailable ? (
            <InlineErrorMessage>この商品は現在、購入手続きの対象外です。</InlineErrorMessage>
          ) : loginRequired ? (
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950" role="status">
              <p className="font-bold">指定購入者アカウントでログインしてください</p>
              <p className="mt-1 text-sm leading-relaxed">
                ログイン後、この購入準備画面へ戻ります。管理者から案内されたアカウントを使用してください。
              </p>
              <Link
                className="button-secondary mt-3"
                href={`/login?next=${encodeURIComponent(`/checkout/${product.id}`)}`}
              >
                ログインして戻る
              </Link>
            </div>
          ) : checkoutEntryAvailable && !canPurchase ? (
            <InlineErrorMessage>この商品は現在、指定された購入者だけが購入できます。</InlineErrorMessage>
          ) : null}

          <div className="mt-6 rounded-md border border-stone-200 bg-stone-50 p-4">
            <h2 className="font-bold">購入からダウンロードまで</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
              <li>指定購入者アカウントと、商品・作品・価格を確認します。</li>
              <li>購入ボタンからStripe画面へ進み、完了後にMANGAIへ戻ります。</li>
              <li>完了画面でダウンロードするか、購入履歴から5分間有効なURLを再発行します。</li>
            </ol>
          </div>

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
          <div className="mt-5 flex flex-col items-start gap-2 sm:flex-row sm:gap-4">
            <Link className="text-leaf underline" href={product.works ? `/works/${product.works.id}` : "/works"}>
              作品ページへ戻る
            </Link>
            {user ? (
              <Link className="text-leaf underline" href="/dashboard/purchases">
                購入履歴を見る
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
