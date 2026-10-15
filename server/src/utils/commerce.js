import { createHmac, timingSafeEqual } from "node:crypto";

const VALID_SORTS = new Set([
  "newest",
  "price-asc",
  "price-desc",
  "rating",
  "popular",
]);

export function isValidVariantSelection(variants, selection) {
  if (variants.length === 0) return selection === "";
  if (!selection || selection.length > 256) return false;

  let selected;
  try {
    selected = JSON.parse(selection);
  } catch {
    return variants.length === 1 && variants[0].options.includes(selection);
  }

  if (!selected || typeof selected !== "object" || Array.isArray(selected)) return false;
  const keys = Object.keys(selected);
  return keys.length === variants.length &&
    variants.every((variant) =>
      typeof selected[variant.name] === "string" &&
      variant.options.includes(selected[variant.name]),
    );
}

export function parseProductQuery(query) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 12);
  const minPrice = query.minPrice === undefined ? undefined : Number(query.minPrice);
  const maxPrice = query.maxPrice === undefined ? undefined : Number(query.maxPrice);
  const minRating = query.minRating === undefined ? undefined : Number(query.minRating);
  if (query.sort !== undefined && !VALID_SORTS.has(query.sort)) {
    throw new TypeError("sort must be newest, price-asc, price-desc, rating, or popular.");
  }
  if (query.inStock !== undefined && !["true", "false", true, false].includes(query.inStock)) {
    throw new TypeError("inStock must be true or false.");
  }
  if (query.featured !== undefined && !["true", "false", true, false].includes(query.featured)) {
    throw new TypeError("featured must be true or false.");
  }

  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    throw new TypeError("page must be a positive integer.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 48) {
    throw new TypeError("limit must be between 1 and 48.");
  }
  if (minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) {
    throw new TypeError("minPrice must be zero or greater.");
  }
  if (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
    throw new TypeError("maxPrice must be zero or greater.");
  }
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new TypeError("minPrice cannot exceed maxPrice.");
  }
  if (minRating !== undefined && (!Number.isFinite(minRating) || minRating < 0 || minRating > 5)) {
    throw new TypeError("minRating must be between 0 and 5.");
  }

  return {
    page,
    limit,
    minPrice,
    maxPrice,
    minRating,
    inStock: query.inStock === "true",
    sort: query.sort ?? "newest",
    search: typeof query.q === "string" ? query.q.trim().slice(0, 120) : "",
    category: typeof query.category === "string" ? query.category.trim().slice(0, 80) : "",
    brand: typeof query.brand === "string" ? query.brand.trim().slice(0, 80) : "",
    featured: query.featured === "true" || query.featured === true,
  };
}

export function calculateOrderTotals(items, coupon, shippingThreshold = 5000) {
  const subtotal = items.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );
  const discount =
    coupon?.type === "percent"
      ? Math.round((subtotal * Math.min(coupon.value, 100)) / 100)
      : Math.min(coupon?.value ?? 0, subtotal);
  const discountedSubtotal = Math.max(subtotal - discount, 0);
  const shipping = discountedSubtotal === 0 || discountedSubtotal >= shippingThreshold ? 0 : 199;

  return {
    subtotal,
    discount,
    shipping,
    total: discountedSubtotal + shipping,
    currency: "INR",
  };
}

export function verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret) {
  if (!orderId || !paymentId || !signature || !secret || !/^[a-f\d]{64}$/i.test(signature)) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyRazorpayWebhookSignature(body, signature, secret) {
  if (!body || !signature || !secret || !/^[a-f\d]{64}$/i.test(signature)) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function canTransitionOrder(status, nextStatus) {
  const transitions = {
    pending: new Set(["processing", "cancelled"]),
    processing: new Set(["shipped", "cancelled"]),
    shipped: new Set(["delivered"]),
    delivered: new Set(),
    cancelled: new Set(),
    refunded: new Set(),
  };
  return transitions[status]?.has(nextStatus) ?? false;
}
