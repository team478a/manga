import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedOrderStatuses,
  planPaymentEvent,
} from "../src/lib/payment-events.ts";

const event = (type, object) => ({ type, data: { object } });

test("決済成功イベントを注文支払済み処理へ変換する", () => {
  const session = {
    id: "cs_test_paid",
    payment_status: "paid",
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
        metadata: { order_id: "order-2" },
      }),
    ),
    {
      type: "payment-status",
      paymentIntentId: "pi_failed",
      status: "failed",
      orderId: "order-2",
    },
  );
  assert.deepEqual(
    planPaymentEvent(
      event("checkout.session.async_payment_failed", {
        payment_intent: { id: "pi_async_failed" },
        metadata: { order_id: "order-3" },
      }),
    ),
    {
      type: "payment-status",
      paymentIntentId: "pi_async_failed",
      status: "failed",
      orderId: "order-3",
    },
  );
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
      event("checkout.session.async_payment_failed", {
        payment_intent: null,
        metadata: { order_id: "order-4" },
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
