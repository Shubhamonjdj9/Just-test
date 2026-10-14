import { z } from "zod";

const email = z.email().max(254).transform((value) => value.toLowerCase().trim());
const password = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(128)
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/\d/, "Password must contain a number.");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password,
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });

export const addressSchema = z.object({
  label: z.string().trim().max(40).default("Home"),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9\s()-]{8,20}$/),
  line1: z.string().trim().min(3).max(180),
  line2: z.string().trim().max(180).default(""),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(3).max(16),
  country: z.string().trim().min(2).max(100).default("India"),
  isDefault: z.boolean().default(false),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(1),
  brand: z.string().trim().max(100).default("Atelier"),
  images: z.array(z.url()).max(8).default([]),
  sku: z.string().trim().min(2).max(80),
  price: z.number().int().min(1).max(100000000),
  discountPercent: z.number().min(0).max(100).default(0),
  stock: z.number().int().min(0).max(1000000).default(0),
  variants: z.array(z.object({
    name: z.string().trim().min(1).max(24),
    options: z.array(z.string().trim().min(1).max(24)).min(1).max(20)
      .refine((options) => new Set(options).size === options.length, "Variant options must be unique."),
  })).max(3).refine(
    (variants) => new Set(variants.map((variant) => variant.name)).size === variants.length,
    "Variant names must be unique.",
  ).default([]),
  isActive: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(0).optional(),
});
export const categoryPatchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(400),
  image: z.union([z.literal(""), z.url()]),
  isActive: z.boolean(),
}).partial().strict().refine((patch) => Object.keys(patch).length > 0, {
  message: "Choose at least one category field to update.",
});
export const checkoutSchema = z.object({
  address: addressSchema,
  couponCode: z.string().trim().max(40).default(""),
});
export const cartItemSchema = z.object({
  productId: z.string().trim().min(1),
  variant: z.string().trim().max(256).default(""),
  quantity: z.number().int().min(1).max(99),
});
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).default(""),
  body: z.string().trim().min(10).max(2000),
});
export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password,
});
