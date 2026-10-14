import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  calculateOrderTotals,
  canTransitionOrder,
  isValidVariantSelection,
  parseProductQuery,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from "./commerce.js";

test("calculates trusted server-side Indian checkout totals", () => {
  assert.deepEqual(
    calculateOrderTotals([{ unitPrice: 1200, quantity: 2 }], { type: "percent", value: 10 }),
    { subtotal: 2400, discount: 240, shipping: 199, total: 2359, currency: "INR" },
  );
});

test("rejects manipulated catalog pagination and invalid price ranges", () => {
  assert.throws(() => parseProductQuery({ limit: "999999" }), /limit/);
  assert.throws(
    () => parseProductQuery({ minPrice: "500", maxPrice: "10" }),
    /cannot exceed/,
  );
});

test("verifies Razorpay signatures and safely rejects unexpected inputs", () => {
  const secret = "test-only-secret";
  const orderId = "order_test_123";
  const paymentId = "pay_test_456";
  const signature = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret), true);
  assert.equal(verifyRazorpayPaymentSignature(orderId, "pay_other", signature, secret), false);
  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, "no", secret), false);

  const body = Buffer.from('{"event":"payment.captured"}');
  const webhook = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyRazorpayWebhookSignature(body, webhook, secret), true);
});

test("only allows permitted forward-only fulfillment transitions", () => {
  assert.equal(canTransitionOrder("processing", "shipped"), true);
  assert.equal(canTransitionOrder("delivered", "processing"), false);
  assert.equal(canTransitionOrder("cancelled", "processing"), false);
});

test("validates complete multi-option product variants", () => {
  const variants = [
    { name: "Size", options: ["Small", "Large"] },
    { name: "Finish", options: ["Oak", "Walnut"] },
  ];
  assert.equal(isValidVariantSelection(variants, JSON.stringify({ Size: "Large", Finish: "Oak" })), true);
  assert.equal(isValidVariantSelection(variants, JSON.stringify({ Size: "Large" })), false);
  assert.equal(isValidVariantSelection(variants, JSON.stringify({ Size: "Other", Finish: "Oak" })), false);
  assert.equal(isValidVariantSelection(variants, JSON.stringify({ Size: "Large", Finish: "Oak", Extra: "x" })), false);
  assert.equal(isValidVariantSelection([{ name: "Size", options: ["Small"] }], "Small"), true);
  assert.equal(isValidVariantSelection([], "Small"), false);
});
