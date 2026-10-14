import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { config } from "../config/env.js";
import { authenticate } from "../middleware/auth.js";
import { Coupon, Order, Payment, Product } from "../models/index.js";
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from "../utils/commerce.js";
import { AppError, asyncHandler } from "../utils/errors.js";

const router = Router();
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.post("/orders", authenticate, paymentLimiter, asyncHandler(async (request, response) => {
  const { orderId } = request.body ?? {};
  const order = await Order.findOne({ _id: orderId, user: request.user._id });
  if (!order) throw new AppError(404, "This order could not be found.");
  if (order.status !== "pending" || order.paymentStatus !== "pending" || order.inventoryReleased) {
    throw new AppError(409, "This order is no longer awaiting payment.");
  }
  if (!config.razorpayKeyId || !config.razorpayKeySecret || config.razorpayKeyId.includes("replace")) {
    throw new AppError(503, "Configure your Razorpay test-mode credentials in the server environment.");
  }
  let payment = await Payment.findOne({ order: order._id });
  if (payment?.providerOrderId) {
    return response.json({ data: { keyId: config.razorpayKeyId, orderId: payment.providerOrderId, amount: payment.amount, currency: payment.currency } });
  }
  const { default: Razorpay } = await import("razorpay");
  const razorpay = new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret });
  const providerOrder = await razorpay.orders.create({
    amount: Math.round(order.total * 100),
    currency: "INR",
    receipt: `atelier_${order.id}`,
    notes: { orderId: order.id, customerId: request.user.id },
  });
  if (providerOrder.amount !== Math.round(order.total * 100) || providerOrder.currency !== order.currency) {
    throw new AppError(502, "Razorpay returned an order with an unexpected amount or currency.");
  }
  payment ??= new Payment({
    order: order._id,
    user: request.user._id,
    amount: providerOrder.amount,
    currency: providerOrder.currency,
  });
  payment.providerOrderId = providerOrder.id;
  await payment.save();
  order.paymentProviderOrderId = providerOrder.id;
  await order.save();
  response.status(201).json({
    data: { keyId: config.razorpayKeyId, orderId: providerOrder.id, amount: providerOrder.amount, currency: providerOrder.currency },
  });
}));

router.post("/verify", authenticate, paymentLimiter, asyncHandler(async (request, response) => {
  const { razorpay_order_id: providerOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = request.body ?? {};
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    throw new AppError(503, "Payment verification is not configured.");
  }
  const payment = await Payment.findOne({ providerOrderId, user: request.user._id });
  if (!payment) throw new AppError(404, "This payment could not be found.");
  if (!verifyRazorpayPaymentSignature(providerOrderId, paymentId, signature, config.razorpayKeySecret)) {
    throw new AppError(400, "Razorpay could not verify this payment signature.");
  }
  const { default: Razorpay } = await import("razorpay");
  const razorpay = new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret });
  const providerPayment = await razorpay.payments.fetch(paymentId);
  if (providerPayment.order_id !== payment.providerOrderId || providerPayment.amount !== payment.amount || providerPayment.currency !== payment.currency) {
    throw new AppError(400, "The verified payment does not match this order's expected amount and currency.");
  }
  if (providerPayment.status === "captured") {
    const order = await Order.findOneAndUpdate(
      { _id: payment.order, user: request.user._id, paymentStatus: { $ne: "paid" }, status: { $ne: "cancelled" }, inventoryReleased: false },
      {
        $set: { paymentStatus: "paid", status: "processing", reservationExpiresAt: null },
        $push: {
          statusHistory: {
            status: "processing",
            actor: null,
            source: "payment",
            note: "Payment captured and independently verified.",
          },
        },
      },
      { new: true },
    );
    if (!order && payment.status !== "paid") throw new AppError(409, "This order was cancelled; contact support to review its payment.");
    payment.status = "paid";
    payment.providerPaymentId = paymentId;
    await payment.save();
    return response.json({ data: { paymentStatus: "paid", order: order ?? await Order.findById(payment.order) } });
  }
  if (providerPayment.status === "authorized") {
    payment.status = "authorized";
    payment.providerPaymentId = paymentId;
    await payment.save();
    return response.status(202).json({ data: { paymentStatus: "pending", message: "Payment authorized; waiting for server-side capture confirmation." } });
  }
  if (providerPayment.status !== "failed") {
    return response.status(202).json({ data: { paymentStatus: "pending", message: "Payment confirmation is still processing." } });
  }
  payment.status = "failed";
  payment.providerPaymentId = paymentId;
  await payment.save();
  response.status(202).json({ data: { paymentStatus: "failed", message: "The payment was not completed." } });
}));

router.post(
  "/webhook",
  asyncHandler(async (request, response) => {
    const signature = request.get("x-razorpay-signature");
    const eventId = request.get("x-razorpay-event-id");
    if (!config.razorpayWebhookSecret) throw new AppError(503, "Razorpay webhook verification is not configured.");
    if (!verifyRazorpayWebhookSignature(request.body, signature, config.razorpayWebhookSecret)) {
      throw new AppError(400, "Razorpay webhook signature verification failed.");
    }
    if (!eventId || eventId.length > 200) throw new AppError(400, "A valid Razorpay event ID is required.");
      let event;
      try {
        event = JSON.parse(request.body.toString("utf8"));
      } catch {
        throw new AppError(400, "Razorpay sent a malformed webhook payload.");
      }
    await processRazorpayEvent(event, eventId);
    response.status(200).json({ received: true });
  }),
);

export async function processRazorpayEvent(event, eventId) {
  if (!eventId || !event?.event) throw new AppError(400, "This payment event could not be identified.");
  if (!["payment.authorized", "payment.captured", "payment.failed", "refund.processed", "refund.failed"].includes(event.event)) {
    return;
  }
  const isRefund = event.event.startsWith("refund.");
  const entity = isRefund ? event.payload?.refund?.entity : event.payload?.payment?.entity;
  const providerOrderId = entity?.order_id ?? event.payload?.payment?.entity?.order_id;
  const lookup = isRefund && entity?.payment_id
    ? { providerPaymentId: entity.payment_id, "refundRequests.providerRefundId": entity.id }
    : { providerOrderId };
  const existing = await Payment.findOne(lookup);
  if (!existing) throw new AppError(404, "This webhook does not match a known store payment.");

  if (isRefund) {
    if (!entity?.id || !Number.isInteger(entity.amount) || entity.amount < 1) {
      throw new AppError(400, "The refund event does not contain a valid refund reference and amount.");
    }
    if (entity.currency && entity.currency !== existing.currency) {
      throw new AppError(400, "The refund event currency does not match the original payment.");
    }
    const refundRequest = existing.refundRequests.find(
      (item) => item.providerRefundId === entity.id,
    );
    if (!refundRequest || refundRequest.amount !== entity.amount) {
      throw new AppError(400, "The refund event does not match a known refund request.");
    }
    if (["processed", "failed"].includes(refundRequest.status)) return;

    const refundStatus = event.event === "refund.processed" ? "processed" : "failed";
    const changes = {
      $addToSet: { webhookEventIds: eventId },
      $set: { "refundRequests.$.status": refundStatus },
      $inc: {
        pendingRefundAmount: -entity.amount,
        ...(refundStatus === "processed" && { refundedAmount: entity.amount }),
      },
    };
    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: existing._id,
        webhookEventIds: { $ne: eventId },
        refundRequests: {
          $elemMatch: {
            providerRefundId: entity.id,
            status: "pending",
            amount: entity.amount,
          },
        },
      },
      changes,
      { new: true },
    );
    if (!updatedPayment) return;
    if (
      refundStatus === "processed" &&
      updatedPayment.refundedAmount >= updatedPayment.amount
    ) {
      updatedPayment.status = "refunded";
      await updatedPayment.save();
      await Order.findOneAndUpdate(
        { _id: updatedPayment.order, paymentStatus: "paid" },
        {
          $set: { paymentStatus: "refunded", status: "refunded" },
          $push: {
            statusHistory: {
              status: "refunded",
              actor: null,
              source: "payment",
              note: "A full payment refund was confirmed by Razorpay.",
            },
          },
        },
        { new: true },
      );
    }
    return;
  }

  const payment = await Payment.findOneAndUpdate(
    { _id: existing._id, webhookEventIds: { $ne: eventId } },
    { $addToSet: { webhookEventIds: eventId } },
    { new: true },
  );
  if (!payment) return;

  if (event.event.startsWith("payment.") &&
      (entity.order_id !== payment.providerOrderId ||
       entity.currency !== payment.currency ||
       (event.event === "payment.captured" && entity.amount !== payment.amount) ||
       (event.event === "payment.failed" && entity.amount !== payment.amount))) {
    throw new AppError(400, "The payment event amount or currency does not match this order.");
  }

  if (event.event === "payment.captured") {
    const order = await Order.findOneAndUpdate(
      {
        _id: payment.order,
        paymentStatus: { $ne: "paid" },
        status: { $ne: "cancelled" },
        inventoryReleased: false,
        total: payment.amount / 100,
        currency: payment.currency,
      },
      {
        $set: { paymentStatus: "paid", status: "processing", reservationExpiresAt: null },
        $push: {
          statusHistory: {
            status: "processing",
            actor: null,
            source: "payment",
            note: "Payment captured and independently verified.",
          },
        },
      },
      { new: true },
    );
    payment.providerPaymentId = entity.id;
    payment.status = "paid";
    await payment.save();
    if (!order) throw new AppError(409, "The payment was captured but its order requires administrator reconciliation.");
    return;
  }

  if (event.event === "payment.authorized") {
    if (payment.status !== "paid") payment.status = "authorized";
    await payment.save();
    return;
  }

  if (event.event === "payment.failed") {
    if (payment.status === "paid") return;
    payment.status = "failed";
    await payment.save();
    return;
  }

}

export async function releaseExpiredReservations(now = new Date()) {
  const expired = await Order.find({
    status: "pending",
    paymentStatus: "pending",
    inventoryReleased: false,
    reservationExpiresAt: { $lte: now, $ne: null },
  })
    .select("_id items couponCode")
    .sort({ reservationExpiresAt: 1 })
    .limit(100)
    .lean();
  let released = 0;

  for (const candidate of expired) {
    const order = await Order.findOneAndUpdate(
      {
        _id: candidate._id,
        status: "pending",
        paymentStatus: "pending",
        inventoryReleased: false,
        reservationExpiresAt: { $lte: now, $ne: null },
      },
      {
        $set: {
          status: "cancelled",
          paymentStatus: "failed",
          inventoryReleased: true,
          cancellationReason: "The payment window expired.",
        },
        $push: {
          statusHistory: {
            status: "cancelled",
            actor: null,
            source: "system",
            note: "Unpaid stock reservation expired after 30 minutes.",
          },
        },
      },
      { new: true },
    );
    if (!order) continue;
    await Promise.all(order.items.map(({ product, quantity }) =>
      Product.updateOne({ _id: product }, { $inc: { stock: quantity } }),
    ));
    if (order.couponCode) {
      await Coupon.updateOne({ code: order.couponCode, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
    }
    released += 1;
  }

  return released;
}

export default router;
