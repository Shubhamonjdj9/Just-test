import { Router } from "express";
import mongoose from "mongoose";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { Cart, Coupon, NewsletterSubscriber, Order, Product, Review } from "../models/index.js";
import {
  calculateOrderTotals,
  canTransitionOrder,
  isValidVariantSelection,
} from "../utils/commerce.js";
import { AppError, asyncHandler } from "../utils/errors.js";
import {
  cartItemSchema,
  checkoutSchema,
  reviewSchema,
} from "../validators/schemas.js";

const router = Router();
const effectivePrice = (product) =>
  Math.round(product.price * (1 - (product.discountPercent ?? 0) / 100));

async function loadCart(userId) {
  const cart = await Cart.findOne({ user: userId }).populate("items.product", "name slug price discountPercent stock images sku isActive variants");
  return cart ?? await Cart.create({ user: userId, items: [] });
}

async function prepareCart(cart) {
  return cart.items
    .filter((item) => item.product?.isActive)
    .map((item) => ({
      product: item.product,
      variant: item.variant,
      quantity: item.quantity,
      unitPrice: effectivePrice(item.product),
    }));
}

router.get("/cart", authenticate, asyncHandler(async (request, response) => {
  const cart = await loadCart(request.user._id);
  const items = await prepareCart(cart);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const coupon = cart.couponCode
    ? await Coupon.findOne({
        code: cart.couponCode,
        isActive: true,
        startsAt: { $lte: new Date() },
        endsAt: { $gte: new Date() },
        $expr: { $lt: ["$usageCount", "$usageLimit"] },
      })
    : null;
  const totals = calculateOrderTotals(
    items.map(({ unitPrice, quantity }) => ({ unitPrice, quantity })),
    coupon && subtotal >= coupon.minimumPurchase ? coupon : null,
  );
  response.json({ data: { items, totals, couponCode: cart.couponCode } });
}));

router.post("/cart/items", authenticate, validate(cartItemSchema), asyncHandler(async (request, response) => {
  const { productId, variant, quantity } = request.body;
  if (!mongoose.isValidObjectId(productId)) throw new AppError(400, "Choose a valid product.");
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new AppError(404, "This product is no longer available.");
  if (!isValidVariantSelection(product.variants, variant)) throw new AppError(400, "Choose an available option for each product variant.");
  const cart = await Cart.findOne({ user: request.user._id }) ?? new Cart({ user: request.user._id });
  const existing = cart.items.find((item) => item.product.equals(product._id) && item.variant === variant);
  if ((existing?.quantity ?? 0) + quantity > 99) {
    throw new AppError(400, "A cart line cannot contain more than 99 units.");
  }
  const requestedQuantity =
    cart.items.filter((item) => item.product.equals(product._id)).reduce((sum, item) => sum + item.quantity, 0) +
    quantity;
  if (requestedQuantity > product.stock) {
    throw new AppError(409, "There aren't that many available. Please choose a smaller quantity.");
  }
  if (existing) existing.quantity += quantity;
  else cart.items.push({ product: product._id, variant, quantity });
  await cart.save();
  response.status(201).json({ data: { message: "Added to your bag.", itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0) } });
}));

router.patch("/cart/items/:productId", authenticate, asyncHandler(async (request, response) => {
  const { quantity, variant = "" } = request.body ?? {};
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new AppError(400, "Quantity must be a whole number between 1 and 99.");
  }
  if (!mongoose.isValidObjectId(request.params.productId)) throw new AppError(400, "Choose a valid product.");
  const cart = await Cart.findOne({ user: request.user._id });
  const item = cart?.items.find((line) => line.product.equals(request.params.productId) && line.variant === variant);
  if (!item) throw new AppError(404, "This item is not in your bag.");
  const product = await Product.findOne({ _id: request.params.productId, isActive: true }).select("stock");
  if (!product || quantity > product.stock) throw new AppError(409, "There aren't that many available. Please choose a smaller quantity.");
  item.quantity = quantity;
  await cart.save();
  response.json({ data: { message: "Your bag has been updated." } });
}));

router.delete("/cart/items/:productId", authenticate, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.productId)) throw new AppError(400, "Choose a valid product.");
  const cart = await Cart.findOne({ user: request.user._id });
  if (!cart) throw new AppError(404, "Your bag is empty.");
  const before = cart.items.length;
  cart.items = cart.items.filter((item) => !(
    item.product.equals(request.params.productId) &&
    item.variant === String(request.query.variant ?? "")
  ));
  if (cart.items.length === before) throw new AppError(404, "This item is not in your bag.");
  await cart.save();
  response.status(204).end();
}));

router.put("/cart/coupon", authenticate, asyncHandler(async (request, response) => {
  const code = typeof request.body?.code === "string" ? request.body.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) throw new AppError(400, "Enter a valid coupon code.");
  const coupon = await Coupon.findOne({ code, isActive: true, startsAt: { $lte: new Date() }, endsAt: { $gte: new Date() }, $expr: { $lt: ["$usageCount", "$usageLimit"] } });
  if (!coupon) throw new AppError(400, "This coupon is unavailable or has expired.");
  const cart = await loadCart(request.user._id);
  cart.couponCode = coupon.code;
  await cart.save();
  response.json({ data: { couponCode: coupon.code, message: "Your coupon has been applied at checkout." } });
}));

router.delete("/cart/coupon", authenticate, asyncHandler(async (request, response) => {
  const cart = await Cart.findOne({ user: request.user._id });
  if (cart) {
    cart.couponCode = "";
    await cart.save();
  }
  response.json({ data: { couponCode: "" } });
}));

router.post("/orders", authenticate, validate(checkoutSchema), asyncHandler(async (request, response) => {
  const idempotencyKey = request.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length > 120 || idempotencyKey.length < 8) {
    throw new AppError(400, "Provide a valid Idempotency-Key header for checkout.");
  }
  const existing = await Order.findOne({ user: request.user._id, idempotencyKey });
  if (existing) return response.status(200).json({ data: { order: existing } });

  const cart = await Cart.findOne({ user: request.user._id }).populate("items.product");
  if (!cart?.items.length) throw new AppError(400, "Add at least one item before checkout.");

  const items = cart.items.map(({ product, variant, quantity }) => {
    if (!product?.isActive) throw new AppError(400, "One of your items is no longer available.");
    if (!isValidVariantSelection(product.variants, variant)) throw new AppError(400, "One of your selected product options is no longer available.");
    return {
      product: product._id,
      name: product.name,
      slug: product.slug,
      image: product.images[0] ?? "",
      sku: product.sku,
      variant,
      unitPrice: effectivePrice(product),
      quantity,
    };
  });
  let coupon = null;
  const couponCode = request.body.couponCode || cart.couponCode;
  if (couponCode) {
    coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      startsAt: { $lte: new Date() },
      endsAt: { $gte: new Date() },
      $expr: { $lt: ["$usageCount", "$usageLimit"] },
    });
    if (!coupon) throw new AppError(400, "This coupon is unavailable or has expired.");
  }

  const totals = calculateOrderTotals(items, coupon);
  if (coupon && totals.subtotal < coupon.minimumPurchase) {
    throw new AppError(400, `This coupon requires a minimum purchase of ₹${coupon.minimumPurchase}.`);
  }

  let reservedCoupon = false;
  if (coupon) {
    const update = await Coupon.updateOne(
      {
        _id: coupon._id,
        isActive: true,
        startsAt: { $lte: new Date() },
        endsAt: { $gte: new Date() },
        $expr: { $lt: ["$usageCount", "$usageLimit"] },
      },
      { $inc: { usageCount: 1 } },
    );
    if (!update.modifiedCount) throw new AppError(409, "This coupon has just reached its usage limit.");
    reservedCoupon = true;
  }

  const reservations = new Map();
  for (const item of items) {
    const key = String(item.product);
    reservations.set(key, (reservations.get(key) ?? 0) + item.quantity);
  }
  const reserved = [];
  try {
    for (const [productId, quantity] of reservations) {
      const update = await Product.updateOne(
        { _id: productId, isActive: true, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
      );
      if (!update.modifiedCount) throw new AppError(409, "An item in your bag has just sold out. Please update your bag.");
      reserved.push({ productId, quantity });
    }

    const order = await Order.create({
      user: request.user._id,
      idempotencyKey,
      items,
      shippingAddress: request.body.address,
      couponCode: coupon?.code ?? "",
      ...totals,
      paymentStatus: totals.total === 0 ? "not_required" : "pending",
      status: totals.total === 0 ? "processing" : "pending",
      reservationExpiresAt: totals.total === 0 ? undefined : new Date(Date.now() + 30 * 60 * 1000),
      statusHistory: [{
        status: totals.total === 0 ? "processing" : "pending",
        actor: request.user._id,
        source: totals.total === 0 ? "system" : "customer",
        note: totals.total === 0 ? "Complimentary order confirmed." : "Order created; awaiting payment.",
      }],
    });
    cart.items = [];
    cart.couponCode = "";
    await cart.save();
    return response.status(201).json({ data: { order } });
  } catch (error) {
    await Promise.all(reserved.map(({ productId, quantity }) => Product.updateOne({ _id: productId }, { $inc: { stock: quantity } })));
    if (reservedCoupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { usageCount: -1 } });
    if (error.code === 11000) {
      const order = await Order.findOne({ user: request.user._id, idempotencyKey });
      if (order) return response.status(200).json({ data: { order } });
    }
    throw error;
  }
}));

router.get("/orders", authenticate, asyncHandler(async (request, response) => {
  const page = Math.max(1, Math.min(Number(request.query.page) || 1, 1000));
  const orders = await Order.find({ user: request.user._id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * 20)
    .limit(20)
    .lean();
  response.json({ data: { orders, page } });
}));

router.get("/orders/:id", authenticate, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new AppError(404, "This order could not be found.");
  const order = await Order.findOne({ _id: request.params.id, user: request.user._id }).lean();
  if (!order) throw new AppError(404, "This order could not be found.");
  response.json({ data: { order } });
}));

router.post("/orders/:id/cancel", authenticate, asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new AppError(404, "This order could not be found.");
  const order = await Order.findOne({ _id: request.params.id, user: request.user._id });
  if (!order) throw new AppError(404, "This order could not be found.");
  if (order.paymentStatus === "paid") throw new AppError(409, "Contact support to request a refund for a paid order.");
  if (order.status !== "pending" || order.inventoryReleased) throw new AppError(409, "Only unpaid pending orders can be cancelled.");
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, user: request.user._id, status: "pending", paymentStatus: "pending", inventoryReleased: false },
    {
      $set: { status: "cancelled", paymentStatus: "failed", inventoryReleased: true },
      $push: { statusHistory: { status: "cancelled", actor: request.user._id, source: "customer", note: "Customer cancelled before payment." } },
    },
    { new: true },
  );
  if (!updated) throw new AppError(409, "This order has already changed.");
  await Promise.all(order.items.map(({ product, quantity }) =>
    Product.updateOne({ _id: product }, { $inc: { stock: quantity } }),
  ));
  if (order.couponCode) await Coupon.updateOne({ code: order.couponCode, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
  response.json({ data: { order: updated } });
}));

router.post("/products/:slug/reviews", authenticate, validate(reviewSchema), asyncHandler(async (request, response) => {
  const product = await Product.findOne({ slug: request.params.slug, isActive: true });
  if (!product) throw new AppError(404, "This product is no longer available.");
  const eligibleOrder = await Order.findOne({
    user: request.user._id,
    status: "delivered",
    paymentStatus: "paid",
    "items.product": product._id,
  }).select("_id");
  if (!eligibleOrder) throw new AppError(403, "Only customers who have received this product can review it.");
  let review;
  try {
    review = await Review.create({ user: request.user._id, product: product._id, order: eligibleOrder._id, ...request.body });
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, "You have already reviewed this purchase.");
    throw error;
  }
  response.status(201).json({ data: { review, message: "Your review is awaiting moderation." } });
}));

router.post("/checkout/preview", authenticate, asyncHandler(async (request, response) => {
  const cart = await Cart.findOne({ user: request.user._id }).populate("items.product");
  if (!cart?.items.length) throw new AppError(400, "Your bag is empty.");
  const items = cart.items.map(({ product, quantity }) => ({ unitPrice: effectivePrice(product), quantity }));
  const code = typeof request.body?.couponCode === "string" && request.body.couponCode.trim()
    ? request.body.couponCode.trim()
    : cart.couponCode;
  let coupon = null;
  if (code) {
    coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
      startsAt: { $lte: new Date() },
      endsAt: { $gte: new Date() },
      $expr: { $lt: ["$usageCount", "$usageLimit"] },
    });
    if (!coupon) throw new AppError(400, "This coupon is unavailable or has expired.");
  }
  const totals = calculateOrderTotals(items, coupon);
  if (coupon && totals.subtotal < coupon.minimumPurchase) throw new AppError(400, `This coupon requires a minimum purchase of ₹${coupon.minimumPurchase}.`);
  response.json({ data: { totals } });
}));

router.post("/newsletter", asyncHandler(async (request, response) => {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new AppError(400, "Enter a valid email address.");
  }
  try {
    await NewsletterSubscriber.create({ email });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  response.status(201).json({ data: { message: "Thanks for joining our notes from the studio." } });
}));

export default router;
