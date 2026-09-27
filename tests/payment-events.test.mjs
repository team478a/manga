import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedOrderStatuses,
  planPaymentEvent,
} from "../src/lib/payment-events.ts";

const event = (type, object, livemode = false) => ({ type, livemode, data: { object } });

test("決済成功イベントを注文支払済み処理へ変換する", () => {
  const session = {
    id: "cs_test_paid",
    payment_status: "paid",
    livemode: false,
    metadata: { order_id: "order-1", product_id: "product-1" },
  };
  assert.deepEqual(
    planPaymentEvent(event("checkout.session.completed", session)),
    { type: "checkout-paid", session },
  );
  assert.deepEqual(
    planPaymentEvent(
      event("checkout.session.async_payment_succeeded", session),
    ),
    { type: "checkout-paid", session },
  );
});

test("同期・非同期の決済失敗を失敗処理へ変換する", () => {
  assert.deepEqual(
    planPaymentEvent(
      event("payment_intent.payment_failed", {
        id: "pi_failed",
        metadata: {
          order_id: "order-2",
          product_id: "product-2",
          creator_id: "creator-2",
          payment_mode: "test",
        },
      }),
    ),
    {
      type: "payment-status",
      paymentIntentId: "pi_failed",
      status: "failed",
      orderId: "order-2",
      productId: "product-2",
      creatorId: "creator-2",
      paymentMode: "test",
    },
  );
  assert.deepEqual(
    planPaymentEvent(
      event("checkout.session.async_payment_failed", {
        payment_intent: { id: "pi_async_failed" },
        metadata: {
          order_id: "order-3",
          product_id: "product-3",
          creator_id: "creator-3",
          payment_mode: "test",
        },
      }),
    ),
    {
      type: "payment-status",
      paymentIntentId: "pi_async_failed",
      status: "failed",
      orderId: "order-3",
      productId: "product-3",
      creatorId: "creator-3",
      paymentMode: "test",
    },
  );
});

test("失敗通知は注文・商品・出品者・決済modeの完全なmetadataだけを受け付ける", () => {
  const metadata = {
    order_id: "order-2",
    product_id: "product-2",
    creator_id: "creator-2",
    payment_mode: "test",
  };
  for (const missing of Object.keys(metadata)) {
    const incomplete = { ...metadata };
    delete incomplete[missing];
    assert.equal(
      planPaymentEvent(
        event("payment_intent.payment_failed", {
          id: "pi_failed",
          metadata: incomplete,
        }),
      ),
      null,
    );
  }
  assert.equal(
    planPaymentEvent(
      event("payment_intent.payment_failed", {
        id: "pi_failed",
        metadata: { ...metadata, payment_mode: "live" },
      }),
    ),
    null,
  );
});

test("決済状態更新は失敗時の注文metadataと返金時のPayment Intentを分離する", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../src/lib/payments.ts", import.meta.url), "utf8"),
  );
  assert.match(source, /action\.status === "failed"/);
  assert.match(source, /\.eq\("id", action\.orderId\)/);
  assert.match(source, /\.eq\("product_id", action\.productId\)/);
  assert.match(source, /\.eq\("creator_id", action\.creatorId\)/);
  assert.match(
    source,
    /: query\.eq\("stripe_payment_intent_id", action\.paymentIntentId\)/,
  );
  assert.match(source, /\.eq\("payment_mode", action\.paymentMode\)/);
});

test("全額返金だけを返金済み処理へ変換する", () => {
  assert.deepEqual(
    planPaymentEvent(
      event("charge.refunded", {
        refunded: true,
        payment_intent: "pi_refunded",
      }),
    ),
    {
      type: "payment-status",
      paymentIntentId: "pi_refunded",
      status: "refunded",
      paymentMode: "test",
    },
  );
  assert.equal(
    planPaymentEvent(
      event("charge.refunded", {
        refunded: false,
        payment_intent: "pi_partial",
      }),
    ),
    null,
  );
});

test("未対応イベントと決済IDのないイベントは無視する", () => {
  assert.equal(planPaymentEvent(event("customer.created", {})), null);
  assert.equal(
    planPaymentEvent(
      event("checkout.session.completed", {
        mode: "subscription",
        payment_status: "paid",
      }),
    ),
    null,
  );
  assert.equal(
    planPaymentEvent(
      event("checkout.session.async_payment_failed", {
        payment_intent: null,
        metadata: {
          order_id: "order-4",
          product_id: "product-4",
          creator_id: "creator-4",
          payment_mode: "test",
        },
      }),
    ),
    null,
  );
});

test("失敗通知はpaid/refundedを上書きせず、返金はpaidより優先される", () => {
  assert.deepEqual(allowedOrderStatuses("failed"), ["pending", "failed"]);
  assert.deepEqual(allowedOrderStatuses("refunded"), [
    "pending",
    "paid",
    "refunded",
  ]);
});
