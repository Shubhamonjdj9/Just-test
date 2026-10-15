import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    label: { type: String, trim: true, maxlength: 40, default: "Home" },
    fullName: { type: String, trim: true, required: true, maxlength: 120 },
    phone: { type: String, trim: true, required: true, maxlength: 20 },
    line1: { type: String, trim: true, required: true, maxlength: 180 },
    line2: { type: String, trim: true, maxlength: 180, default: "" },
    city: { type: String, trim: true, required: true, maxlength: 100 },
    state: { type: String, trim: true, required: true, maxlength: 100 },
    postalCode: { type: String, trim: true, required: true, maxlength: 16 },
    country: { type: String, trim: true, required: true, default: "India" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    addresses: { type: [addressSchema], default: [] },
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, result) => {
        delete result.passwordHash;
        delete result.resetTokenHash;
        delete result.resetTokenExpiresAt;
        return result;
      },
    },
  },
);
userSchema.index({ createdAt: -1 });
userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};
userSchema.methods.checkPassword = function checkPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    brand: { type: String, trim: true, maxlength: 100, default: "Atelier" },
    images: [{ type: String, trim: true }],
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    price: { type: Number, required: true, min: 1 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    variants: [{
      name: { type: String, trim: true },
      options: [{ type: String, trim: true }],
    }],
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true },
);
productSchema.index({ name: "text", description: "text", brand: "text" });
productSchema.index({ isActive: 1, category: 1, price: 1, createdAt: -1 });

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 400, default: "" },
    image: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const cartSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [{
      product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      variant: { type: String, trim: true, maxlength: 256, default: "" },
      quantity: { type: Number, required: true, min: 1, max: 99 },
    }],
    couponCode: { type: String, trim: true, uppercase: true, default: "" },
  },
  { timestamps: true },
);

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    idempotencyKey: { type: String, required: true },
    items: [{
      product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      name: { type: String, required: true },
      slug: { type: String, required: true },
      image: { type: String, default: "" },
      sku: { type: String, required: true },
      variant: { type: String, maxlength: 256, default: "" },
      unitPrice: { type: Number, required: true, min: 0 },
      quantity: { type: Number, required: true, min: 1 },
    }],
    shippingAddress: { type: addressSchema, required: true },
    couponCode: { type: String, default: "" },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "not_required"],
      default: "pending",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
    },
    paymentProviderOrderId: { type: String, default: "" },
    inventoryReleased: { type: Boolean, default: false },
    reservationExpiresAt: { type: Date, default: null },
    cancellationReason: { type: String, default: "" },
    statusHistory: [{
      status: {
        type: String,
        enum: ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"],
        required: true,
      },
      actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
      source: { type: String, enum: ["customer", "administrator", "payment", "system"], required: true },
      note: { type: String, trim: true, maxlength: 200, default: "" },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true },
);
orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ createdAt: -1, status: 1 });

const paymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: ["razorpay"], default: "razorpay" },
    providerOrderId: { type: String, unique: true, sparse: true },
    providerPaymentId: { type: String, unique: true, sparse: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    status: {
      type: String,
      enum: ["created", "authorized", "paid", "failed", "refunded"],
      default: "created",
    },
    refundedAmount: { type: Number, min: 0, default: 0 },
    pendingRefundAmount: { type: Number, min: 0, default: 0 },
    refundRequests: [{
      requestId: { type: String, required: true },
      providerRefundId: { type: String, default: "" },
      amount: { type: Number, required: true, min: 1 },
      status: { type: String, enum: ["requested", "pending", "processed", "failed"], default: "requested" },
      createdAt: { type: Date, default: Date.now },
    }],
    webhookEventIds: [{ type: String }],
  },
  { timestamps: true },
);

const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120, default: "" },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    isApproved: { type: Boolean, default: false },
  },
  { timestamps: true },
);
reviewSchema.index({ user: 1, product: 1, order: 1 }, { unique: true });

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 1 },
    minimumPurchase: { type: Number, min: 0, default: 0 },
    usageLimit: { type: Number, min: 1, default: 1000 },
    usageCount: { type: Number, min: 0, default: 0 },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const contactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: ["new", "read", "resolved"], default: "new" },
  },
  { timestamps: true },
);
contactSchema.index({ createdAt: -1, status: 1 });

const subscriberSchema = new Schema(
  { email: { type: String, required: true, unique: true, lowercase: true, trim: true } },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
export const Product = mongoose.model("Product", productSchema);
export const Category = mongoose.model("Category", categorySchema);
export const Cart = mongoose.model("Cart", cartSchema);
export const Order = mongoose.model("Order", orderSchema);
export const Payment = mongoose.model("Payment", paymentSchema);
export const Review = mongoose.model("Review", reviewSchema);
export const Coupon = mongoose.model("Coupon", couponSchema);
export const ContactMessage = mongoose.model("ContactMessage", contactSchema);
export const NewsletterSubscriber = mongoose.model("NewsletterSubscriber", subscriberSchema);
