import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { rateLimit } from "express-rate-limit";
import { config } from "../config/env.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { Category, ContactMessage, Coupon, Order, Payment, Product, Review, User } from "../models/index.js";
import { canTransitionOrder } from "../utils/commerce.js";
import { AppError, asyncHandler } from "../utils/errors.js";
import { categoryPatchSchema, productSchema } from "../validators/schemas.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return callback(new AppError(400, "Upload a JPEG, PNG, or WebP image."));
    }
    callback(null, true);
  },
});
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false });

router.use(authenticate, requireAdmin, adminLimiter);

router.get("/overview", asyncHandler(async (_request, response) => {
  const days = Number(_request.query.days ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new AppError(400, "Choose a reporting range between 1 and 365 days.");
  }
  const since = new Date();
  since.setDate(since.getDate() - days);
  const [orders, customers, productCount, lowStock, sales, recentOrders, topProducts] = await Promise.all([
    Order.countDocuments(),
    User.countDocuments({ role: "customer" }),
    Product.countDocuments({ isActive: true }),
    Product.find({ isActive: true, stock: { $lte: 5 } }).select("name sku stock").sort({ stock: 1 }).limit(8).lean(),
    Order.aggregate([
      { $match: { paymentStatus: "paid", status: { $nin: ["cancelled", "refunded"] } } },
      { $facet: {
        summary: [{ $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }],
        byDay: [
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
      } },
    ]),
    Order.find().populate("user", "name email").sort({ createdAt: -1 }).limit(8).lean(),
    Order.aggregate([
      { $match: { paymentStatus: "paid", status: { $nin: ["cancelled", "refunded"] } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", name: { $first: "$items.name" }, units: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } } } },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const summary = sales[0]?.summary[0] ?? { revenue: 0, orders: 0 };
  response.json({
    data: {
      metrics: { orders, customers, products: productCount, revenue: summary.revenue, paidOrders: summary.orders },
      lowStock,
      recentOrders,
      topProducts,
      salesTrend: sales[0]?.byDay ?? [],
    },
  });
}));

router.get("/products", asyncHandler(async (request, response) => {
  const page = Math.max(1, Math.min(Number(request.query.page) || 1, 10000));
  const [products, total] = await Promise.all([
    Product.find().populate("category", "name slug").sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).lean(),
    Product.countDocuments(),
  ]);
  response.json({ data: { products, pagination: { page, total, pages: Math.ceil(total / 25) } } });
}));

router.post("/products", validate(productSchema), asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.body.category) || !(await Category.exists({ _id: request.body.category, isActive: true }))) {
    throw new AppError(400, "Choose an existing, active category.");
  }
  const product = await Product.create(request.body);
  response.status(201).json({ data: { product } });
}));

router.put("/products/:id", validate(productSchema), asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new AppError(404, "That product could not be found.");
  if (!mongoose.isValidObjectId(request.body.category) || !(await Category.exists({ _id: request.body.category, isActive: true }))) {
    throw new AppError(400, "Choose an existing, active category.");
  }
  const product = await Product.findByIdAndUpdate(request.params.id, request.body, { new: true, runValidators: true });
  if (!product) throw new AppError(404, "That product could not be found.");
  response.json({ data: { product } });
}));

router.delete("/products/:id", asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new AppError(404, "That product could not be found.");
  const product = await Product.findByIdAndUpdate(request.params.id, { isActive: false }, { new: true });
  if (!product) throw new AppError(404, "That product could not be found.");
  response.json({ data: { product, message: "The product has been archived." } });
}));

router.post("/uploads", upload.single("image"), asyncHandler(async (request, response) => {
  if (!request.file) throw new AppError(400, "Choose an image to upload.");
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new AppError(503, "Configure Cloudinary credentials in the server environment to enable image uploads.");
  }
  const bytes = request.file.buffer;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!jpeg && !png && !webp) {
    throw new AppError(400, "This file is not a valid JPEG, PNG, or WebP image.");
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  const image = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: "atelier/products", resource_type: "image" },
      (error, result) => error || !result?.secure_url
        ? reject(new AppError(502, "Cloudinary could not accept this image."))
        : resolve(result),
    ).end(request.file.buffer);
  });
  response.status(201).json({ data: { url: image.secure_url, width: image.width, height: image.height } });
}));

router.get("/categories", asyncHandler(async (_request, response) => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  response.json({ data: { categories } });
}));

router.post("/categories", asyncHandler(async (request, response) => {
  const { name, slug, description = "", image = "" } = request.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2 || name.length > 80 || typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || (image && !URL.canParse(image))) {
    throw new AppError(400, "Provide a category name, lowercase hyphenated slug, and valid image URL.");
  }
  const category = await Category.create({ name: name.trim(), slug, description, image });
  response.status(201).json({ data: { category } });
}));

router.patch("/categories/:id", validate(categoryPatchSchema), asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new AppError(404, "That category could not be found.");
  const category = await Category.findByIdAndUpdate(request.params.id, { $set: request.body }, { new: true, runValidators: true });
  if (!category) throw new AppError(404, "That category could not be found.");
  response.json({ data: { category } });
}));

router.get("/orders", asyncHandler(async (request, response) => {
  const page = Math.max(1, Math.min(Number(request.query.page) || 1, 10000));
  const filter = {};
  for (const field of ["status", "paymentStatus"]) {
    if (typeof request.query[field] === "string") filter[field] = request.query[field];
  }
  const [orders, total] = await Promise.all([
    Order.find(filter).populate("user", "name email").sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).lean(),
    Order.countDocuments(filter),
  ]);
  response.json({ data: { orders, pagination: { page, total, pages: Math.ceil(total / 25) } } });
}));

router.patch("/orders/:id/status", asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new AppError(404, "That order could not be found.");
  const { status } = request.body ?? {};
  const order = await Order.findById(request.params.id);
  if (!order) throw new AppError(404, "That order could not be found.");
  if (!canTransitionOrder(order.status, status)) throw new AppError(409, "This order cannot move to that fulfillment status.");
  if (status === "processing" && !["paid", "not_required"].includes(order.paymentStatus)) throw new AppError(409, "Only paid or complimentary orders can enter fulfillment.");
  if (status === "cancelled" && order.paymentStatus === "paid") throw new AppError(409, "Paid orders require a refund through the payment gateway.");
  if (status === "cancelled" && order.inventoryReleased) throw new AppError(409, "The reserved inventory has already been returned.");
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status, ...(status === "cancelled" && { inventoryReleased: false }) },
    {
      $set: { status },
      $push: {
        statusHistory: {
          status,
          actor: request.user._id,
          source: "administrator",
          note: "Fulfillment status updated by a store administrator.",
        },
      },
    },
    { new: true, runValidators: true },
  );
  if (!updated) throw new AppError(409, "This order has just changed. Refresh and try again.");
  if (status === "cancelled") {
    await Promise.all(order.items.map(({ product, quantity }) => Product.updateOne({ _id: product }, { $inc: { stock: quantity } })));
    if (order.couponCode) await Coupon.updateOne({ code: order.couponCode, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
    updated.inventoryReleased = true;
    updated.paymentStatus = "failed";
    await updated.save();
  }
  response.json({ data: { order: updated } });
}));

router.post("/orders/:id/refund", asyncHandler(async (request, response) => {
  const requestId = request.get("idempotency-key");
  if (!requestId || requestId.length < 8 || requestId.length > 120) {
    throw new AppError(400, "Provide a valid Idempotency-Key header for the refund request.");
  }
  if (!mongoose.isValidObjectId(request.params.id)) throw new AppError(404, "That order could not be found.");
  const order = await Order.findById(request.params.id);
  if (!order || order.paymentStatus !== "paid") throw new AppError(409, "Only paid orders can be refunded.");
  if (!config.razorpayKeyId || !config.razorpayKeySecret) throw new AppError(503, "Configure Razorpay test credentials to issue refunds.");
  const payment = await Payment.findOne({ order: order._id, status: "paid" });
  if (!payment?.providerPaymentId) throw new AppError(409, "The captured payment reference could not be found.");
  const priorRequest = payment.refundRequests.find((item) => item.requestId === requestId);
  if (priorRequest) {
    return response.status(priorRequest.status === "processed" ? 200 : 202).json({
      data: { refundId: priorRequest.providerRefundId, status: priorRequest.status, amount: priorRequest.amount, currency: order.currency },
    });
  }
  const amount = Number(request.body?.amount ?? payment.amount - payment.refundedAmount - payment.pendingRefundAmount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > payment.amount - payment.refundedAmount - payment.pendingRefundAmount) {
    throw new AppError(400, "Enter a valid refund amount no greater than the captured, unrefunded balance.");
  }
  const reserved = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      status: "paid",
      refundRequests: { $not: { $elemMatch: { requestId } } },
      $expr: {
        $lte: [
          { $add: [
            { $ifNull: ["$refundedAmount", 0] },
            { $ifNull: ["$pendingRefundAmount", 0] },
            amount,
          ] },
          "$amount",
        ],
      },
    },
    {
      $inc: { pendingRefundAmount: amount },
      $push: { refundRequests: { requestId, amount, status: "requested" } },
    },
    { new: true },
  );
  if (!reserved) {
    const duplicate = await Payment.findOne({ _id: payment._id, "refundRequests.requestId": requestId });
    const previous = duplicate?.refundRequests.find((item) => item.requestId === requestId);
    if (previous) {
      return response.status(202).json({ data: { refundId: previous.providerRefundId, status: previous.status, amount: previous.amount, currency: order.currency } });
    }
    throw new AppError(409, "This payment balance has just changed; refresh the order before requesting a refund.");
  }
  const { default: Razorpay } = await import("razorpay");
  const razorpay = new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret });
  let refund;
  try {
    refund = await razorpay.payments.refund(payment.providerPaymentId, {
      amount,
      notes: { orderId: order.id, requestId },
    });
  } catch (error) {
    await Payment.updateOne(
      { _id: payment._id, "refundRequests.requestId": requestId },
      {
        $inc: { pendingRefundAmount: -amount },
        $set: { "refundRequests.$.status": "failed" },
      },
    );
    throw new AppError(502, "Razorpay could not accept this refund request. Check the payment record before trying again.");
  }
  if (!refund?.id) throw new AppError(502, "Razorpay did not provide a refund reference.");
  await Payment.updateOne(
    { _id: payment._id, "refundRequests.requestId": requestId },
    {
      $set: {
        "refundRequests.$.providerRefundId": refund.id,
        "refundRequests.$.status": "pending",
      },
    },
  );
  response.status(202).json({ data: { refundId: refund.id, status: refund.status, amount, currency: order.currency, message: "The refund is processing; the signed Razorpay webhook will confirm its final status." } });
}));

router.get("/customers", asyncHandler(async (request, response) => {
  const page = Math.max(1, Math.min(Number(request.query.page) || 1, 10000));
  const [customers, total] = await Promise.all([
    User.find({ role: "customer" }).select("name email createdAt").sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).lean(),
    User.countDocuments({ role: "customer" }),
  ]);
  response.json({ data: { customers, pagination: { page, total, pages: Math.ceil(total / 25) } } });
}));

router.get("/reviews", asyncHandler(async (_request, response) => {
  const reviews = await Review.find().populate("user", "name").populate("product", "name slug").sort({ createdAt: -1 }).limit(100).lean();
  response.json({ data: { reviews } });
}));

router.patch("/reviews/:id", asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id) || typeof request.body?.isApproved !== "boolean") throw new AppError(400, "Provide a valid review and moderation status.");
  const review = await Review.findByIdAndUpdate(request.params.id, { isApproved: request.body.isApproved }, { new: true });
  if (!review) throw new AppError(404, "That review could not be found.");
  const [aggregate] = await Review.aggregate([
    { $match: { product: review.product, isApproved: true } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: review.product },
    { $set: { averageRating: aggregate?.average ?? 0, reviewCount: aggregate?.count ?? 0 } },
  );
  response.json({ data: { review } });
}));

router.get("/contact", asyncHandler(async (request, response) => {
  const page = Math.max(1, Math.min(Number(request.query.page) || 1, 10000));
  const messages = await ContactMessage.find().sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).lean();
  response.json({ data: { messages, page } });
}));

router.patch("/contact/:id", asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id) || !["new", "read", "resolved"].includes(request.body?.status)) throw new AppError(400, "Provide a valid contact-message status.");
  const message = await ContactMessage.findByIdAndUpdate(request.params.id, { status: request.body.status }, { new: true });
  if (!message) throw new AppError(404, "That message could not be found.");
  response.json({ data: { message } });
}));

router.get("/coupons", asyncHandler(async (_request, response) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).limit(200).lean();
  response.json({ data: { coupons } });
}));

router.post("/coupons", asyncHandler(async (request, response) => {
  const { code, type, value, minimumPurchase = 0, usageLimit = 100, endsAt } = request.body ?? {};
  if (typeof code !== "string" || !/^[A-Z0-9_-]{2,40}$/i.test(code) || !["fixed", "percent"].includes(type) || !Number.isInteger(value) || value <= 0 || value > (type === "percent" ? 100 : 1000000) || !Number.isInteger(minimumPurchase) || minimumPurchase < 0 || !Number.isInteger(usageLimit) || usageLimit < 1 || !endsAt || new Date(endsAt) <= new Date()) {
    throw new AppError(400, "Enter a valid, unexpired coupon with a positive fixed amount or percentage and usage limit.");
  }
  const coupon = await Coupon.create({ code: code.toUpperCase(), type, value, minimumPurchase, usageLimit, endsAt: new Date(endsAt) });
  response.status(201).json({ data: { coupon } });
}));

export default router;
