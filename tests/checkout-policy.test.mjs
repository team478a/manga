import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCheckoutOrder,
  createCheckoutCancelToken,
  normalizeBuyerEmail,
  paidSessionReference,
  resolveCheckoutOrigin,
  verifyCheckoutCancelToken,
} from "../src/lib/checkout-policy.ts";

const order = () => ({
  id: "order-1",
  buyer_email: "buyer@example.com",
  product_id: "product-1",
  creator_id: "creator-1",
  amount: 1200,
  status: "pending",
  digital_products: {
    id: "product-1",
    status: "active",
    creator_id: "creator-1",
    works: { is_public: true, content_class: "general" },
  },
});

test("購入者メールを正規化し、不正な形式を拒否する", () => {
  assert.equal(normalizeBuyerEmail(" Buyer@Example.COM "), "buyer@example.com");
  assert.throws(() => normalizeBuyerEmail("buyer@example"), /確認/);
  assert.throws(
    () => normalizeBuyerEmail("a".repeat(255) + "@example.com"),
    /確認/,
  );
});

test("pending注文の商品・購入者・出品者・公開状態を照合する", () => {
  const value = order();
  assert.equal(
    assertCheckoutOrder(value, {
      orderId: "order-1",
      productId: "product-1",
      buyerEmail: "BUYER@example.com",
    }),
    value,
  );
  assert.throws(
    () =>
      assertCheckoutOrder(
        { ...value, product_id: "product-2" },
        {
          orderId: "order-1",
          productId: "product-1",
          buyerEmail: "buyer@example.com",
        },
      ),
    /商品情報/,
  );
  assert.throws(
    () =>
      assertCheckoutOrder(
        {
          ...value,
          digital_products: { ...value.digital_products, status: "paused" },
        },
        {
          orderId: "order-1",
          productId: "product-1",
          buyerEmail: "buyer@example.com",
        },
      ),
    /購入できません/,
  );
  assert.throws(
    () =>
      assertCheckoutOrder(
        {
          ...value,
          digital_products: {
            ...value.digital_products,
            works: { is_public: true, content_class: "adult" },
          },
        },
        {
          orderId: "order-1",
          productId: "product-1",
          buyerEmail: "buyer@example.com",
        },
      ),
    /購入できません/,
  );
});

test("本番URLは設定済みHTTPS originだけを許可する", () => {
  assert.equal(
    resolveCheckoutOrigin({
      configured: "https://hub.mangai.example",
      production: true,
    }),
    "https://hub.mangai.example",
  );
  assert.equal(
    resolveCheckoutOrigin({
      requestOrigin: "http://localhost:3000",
      production: false,
    }),
    "http://localhost:3000",
  );
  assert.throws(
    () => resolveCheckoutOrigin({ production: true }),
    /NEXT_PUBLIC_SITE_URL/,
  );
  assert.throws(
    () =>
      resolveCheckoutOrigin({
        configured: "http://hub.mangai.example",
        production: true,
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      resolveCheckoutOrigin({
        configured: "https://hub.mangai.example/subpath",
        production: true,
      }),
    /origin/,
  );
});

test("注文IDには改ざん検出可能なキャンセルトークンを付与する", () => {
  const secret = "test-secret-at-least-32-characters";
  const token = createCheckoutCancelToken("order-1", secret);
  assert.equal(verifyCheckoutCancelToken("order-1", token, secret), true);
  assert.equal(verifyCheckoutCancelToken("order-2", token, secret), false);
  assert.equal(
    verifyCheckoutCancelToken("order-1", token.slice(2), secret),
    false,
  );
  assert.equal(verifyCheckoutCancelToken("order-1", token, "short"), false);
});

test("支払済みSessionから注文IDと商品IDの組だけを取得する", () => {
  assert.deepEqual(
    paidSessionReference({
      payment_status: "paid",
      metadata: { order_id: "order-1", product_id: "product-1" },
    }),
    { orderId: "order-1", productId: "product-1" },
  );
  assert.equal(
    paidSessionReference({
      payment_status: "unpaid",
      metadata: { order_id: "order-1", product_id: "product-1" },
    }),
    null,
  );
  assert.equal(
    paidSessionReference({
      payment_status: "paid",
      metadata: { order_id: "order-1" },
    }),
    null,
  );
});
