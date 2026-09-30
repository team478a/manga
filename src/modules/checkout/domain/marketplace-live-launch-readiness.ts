import type { MarketplaceLiveCanaryTarget } from "../../../lib/checkout-canary.ts";
import type { MarketplaceCheckoutOperationalReadiness } from "./marketplace-checkout-operational-readiness.ts";

export type MarketplaceLiveLaunchProduct = {
  id?: unknown;
  work_id?: unknown;
  creator_id?: unknown;
  price?: unknown;
  status?: unknown;
  file_url?: unknown;
};

export type MarketplaceLiveLaunchWork = {
  id?: unknown;
  creator_id?: unknown;
  status?: unknown;
  is_public?: unknown;
  content_class?: unknown;
  source_project_id?: unknown;
  current_publication_id?: unknown;
};

export type MarketplaceLiveLaunchProfile = {
  id?: unknown;
  role?: unknown;
};

export type MarketplaceLiveLaunchOrder = {
  id?: unknown;
  status?: unknown;
};

export type MarketplaceLiveLaunchCheckId =
  | "checkout-settings"
  | "exact-product"
  | "public-fixed-work"
  | "isolated-participants"
  | "no-existing-order";

export type MarketplaceLiveLaunchReadiness = {
  ready: boolean;
  checks: Array<{
    id: MarketplaceLiveLaunchCheckId;
    ready: boolean;
    reason: string;
  }>;
};

const check = (
  id: MarketplaceLiveLaunchCheckId,
  ready: boolean,
  reason: string,
) => ({ id, ready, reason });

export function assessMarketplaceLiveLaunchReadiness(input: {
  checkout: MarketplaceCheckoutOperationalReadiness;
  target: MarketplaceLiveCanaryTarget | null;
  products?: MarketplaceLiveLaunchProduct[];
  work?: MarketplaceLiveLaunchWork | null;
  profiles?: MarketplaceLiveLaunchProfile[];
  existingOrders?: MarketplaceLiveLaunchOrder[];
}): MarketplaceLiveLaunchReadiness {
  const checkoutReady = Boolean(
    input.checkout.ready &&
    input.checkout.mode === "live" &&
    input.checkout.canary?.ready &&
    input.target,
  );
  const target = checkoutReady ? input.target : null;
  const products = input.products ?? [];
  const product = products.length === 1 ? products[0] : null;
  const work = input.work ?? null;
  const price = Number(product?.price);
  const productReady = Boolean(
    target &&
    product?.id === target.productId &&
    product.creator_id === target.sellerProfileId &&
    product.status === "active" &&
    Number.isInteger(price) &&
    price >= 50 &&
    price <= 1000 &&
    typeof product.file_url === "string" &&
    product.file_url.trim(),
  );
  const workReady = Boolean(
    target &&
    productReady &&
    work &&
    work.id === product?.work_id &&
    work.creator_id === target.sellerProfileId &&
    work.status === "published" &&
    work.is_public === true &&
    work.content_class === "general" &&
    (!work.source_project_id || work.current_publication_id),
  );
  const profiles = input.profiles ?? [];
  const seller = target
    ? profiles.find((profile) => profile.id === target.sellerProfileId)
    : null;
  const participantIds = new Set(profiles.map((profile) => profile.id));
  const participantsReady = Boolean(
    target &&
    profiles.length === 2 &&
    participantIds.has(target.sellerProfileId) &&
    participantIds.has(target.buyerProfileId) &&
    ["creator", "admin"].includes(String(seller?.role)),
  );
  const noExistingOrder = Boolean(
    target && input.existingOrders && input.existingOrders.length === 0,
  );
  const checks = [
    check(
      "checkout-settings",
      checkoutReady,
      checkoutReady
        ? "限定本番の購入設定とcanary期限が有効です。"
        : "限定本番の購入設定とcanary期限を確認してください。",
    ),
    check(
      "exact-product",
      productReady,
      productReady
        ? "設定対象は販売中で、価格と販売ファイルを確認できました。"
        : "設定対象の商品状態、価格、販売ファイルを確認してください。",
    ),
    check(
      "public-fixed-work",
      workReady,
      workReady
        ? "一般向け作品は公開済みで、Cloud完成版も固定されています。"
        : "一般向け作品の公開状態とCloud完成版の固定を確認してください。",
    ),
    check(
      "isolated-participants",
      participantsReady,
      participantsReady
        ? "販売者と指定購入者を別アカウントとして確認できました。"
        : "販売者権限と指定購入者の登録状態を確認してください。",
    ),
    check(
      "no-existing-order",
      noExistingOrder,
      noExistingOrder
        ? "同じ対象の処理中・支払済み本番注文はありません。"
        : "同じ対象の処理中・支払済み本番注文を確認してください。",
    ),
  ];

  return {
    ready: checks.every((item) => item.ready),
    checks,
  };
}
