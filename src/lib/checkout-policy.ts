import crypto from "node:crypto";
import type Stripe from "stripe";
import {
  ProviderUnavailableError,
  ValidationError,
} from "./domain-errors.ts";
import {
  paymentModeForStripeLivemode,
  type OrderPaymentMode,
} from "./checkout-mode.ts";

export type CheckoutOrderPolicy = {
  id: string;
  buyer_email: string;
  product_id: string;
  creator_id: string;
  amount: number;
  status: string;
  payment_mode: OrderPaymentMode;
  digital_products: {
    id: string;
    status: string;
    creator_id: string;
    works: {
      is_public: boolean;
      content_class: "general" | "adult";
    } | null;
  } | null;
};

export function normalizeBuyerEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ValidationError("購入者メールアドレスを確認してください。");
  return email;
}

export function assertCheckoutOrder<T extends CheckoutOrderPolicy>(
  order: T | null,
  expected: {
    orderId: string;
    productId: string;
    buyerEmail: string;
    paymentMode: OrderPaymentMode;
  },
): T & { digital_products: NonNullable<T["digital_products"]> } {
  if (!order || order.id !== expected.orderId || order.status !== "pending")
    throw new ValidationError("決済準備できる注文が見つかりません。");
  if (
    order.product_id !== expected.productId ||
    order.digital_products?.id !== expected.productId
  )
    throw new ValidationError("注文の商品情報が一致しません。");
  if (
    normalizeBuyerEmail(order.buyer_email) !==
    normalizeBuyerEmail(expected.buyerEmail)
  )
    throw new ValidationError(
      "購入者メールアドレスが注文情報と一致しません。",
    );
  if (order.payment_mode !== expected.paymentMode)
    throw new ValidationError("注文の決済環境が現在の販売モードと一致しません。");
  if (
    order.digital_products.status !== "active" ||
    !order.digital_products.works?.is_public ||
    order.digital_products.works.content_class !== "general"
  )
    throw new ValidationError("この商品は現在購入できません。");
  if (
    order.creator_id !== order.digital_products.creator_id ||
    !Number.isSafeInteger(order.amount) ||
    order.amount < 0
  )
    throw new ValidationError("注文金額または出品者情報が不正です。");
  return order as T & {
    digital_products: NonNullable<T["digital_products"]>;
  };
}

export function resolveCheckoutOrigin({
  configured,
  requestOrigin,
  production,
}: {
  configured?: string;
  requestOrigin?: string;
  production: boolean;
}) {
  if (production && !configured?.trim())
    throw new ProviderUnavailableError(
      "本番環境ではNEXT_PUBLIC_SITE_URLが必要です。",
    );
  const value =
    configured?.trim() || requestOrigin?.trim() || "http://localhost:3000";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderUnavailableError("サイトURLが正しくありません。");
  }
  const local =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new ProviderUnavailableError(
      "サイトURLはHTTPSのoriginで指定してください。",
    );
  return url.origin;
}

type CheckoutOriginEnvironment = {
  NEXT_PUBLIC_SITE_URL?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
};

export function resolveCheckoutDeploymentOrigin({
  environment = process.env,
  requestOrigin,
}: {
  environment?: CheckoutOriginEnvironment;
  requestOrigin?: string;
}) {
  const vercelEnvironment = environment.VERCEL_ENV?.trim().toLowerCase();

  if (vercelEnvironment === "preview") {
    const deploymentUrl = environment.VERCEL_URL?.trim();
    const previewOrigin =
      requestOrigin?.trim() ||
      (deploymentUrl
        ? deploymentUrl.includes("://")
          ? deploymentUrl
          : `https://${deploymentUrl}`
        : undefined);
    return resolveCheckoutOrigin({
      requestOrigin: previewOrigin,
      production: false,
    });
  }

  return resolveCheckoutOrigin({
    configured: environment.NEXT_PUBLIC_SITE_URL,
    requestOrigin,
    production:
      vercelEnvironment === "production" ||
      (!vercelEnvironment && environment.NODE_ENV === "production"),
  });
}

export function createCheckoutCancelToken(orderId: string, secret: string) {
  if (!orderId || secret.length < 16)
    throw new ProviderUnavailableError("キャンセル認証設定が不足しています。");
  return crypto.createHmac("sha256", secret).update(orderId).digest("hex");
}

export function verifyCheckoutCancelToken(
  orderId: string,
  token: string,
  secret: string,
) {
  try {
    const expected = Buffer.from(
      createCheckoutCancelToken(orderId, secret),
      "hex",
    );
    const actual = Buffer.from(token, "hex");
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

export function paidSessionReference(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  const productId = session.metadata?.product_id;
  const paymentMode = paymentModeForStripeLivemode(Boolean(session.livemode));
  const metadataMode = session.metadata?.payment_mode;
  if (
    session.payment_status !== "paid" ||
    !orderId ||
    !productId ||
    (metadataMode && metadataMode !== paymentMode)
  )
    return null;
  return { orderId, productId, paymentMode };
}
