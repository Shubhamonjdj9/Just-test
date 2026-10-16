import { randomBytes, createHash } from "node:crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { config } from "../config/env.js";
import { Product, User } from "../models/index.js";
import { authenticate, SESSION_DURATION_SECONDS, sessionCookie } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema, addressSchema, resetPasswordSchema } from "../validators/schemas.js";
import { AppError, asyncHandler } from "../utils/errors.js";

const router = Router();
const cookieName = "atelier_session";

function setSession(response, user) {
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: SESSION_DURATION_SECONDS });
  response.cookie(cookieName, token, sessionCookie);
}

router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (request, response) => {
    const user = new User({
      name: request.body.name,
      email: request.body.email,
    });
    await user.setPassword(request.body.password);
    try {
      await user.save();
    } catch (error) {
      if (error.code === 11000) throw new AppError(409, "An account with this email already exists.");
      throw error;
    }
    setSession(response, user);
    response.status(201).json({ data: { user } });
  }),
);

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (request, response) => {
    const user = await User.findOne({ email: request.body.email }).select("+passwordHash");
    if (!user || !(await user.checkPassword(request.body.password))) {
      throw new AppError(401, "The email or password is incorrect.");
    }
    setSession(response, user);
    response.json({ data: { user } });
  }),
);

router.post("/logout", (_request, response) => {
  response.clearCookie(cookieName, { ...sessionCookie, maxAge: undefined });
  response.status(200).json({ data: { message: "You have been signed out." } });
});

router.get("/me", authenticate, (request, response) => {
  response.json({ data: { user: request.user } });
});

router.post(
  "/forgot-password",
  asyncHandler(async (request, response) => {
    const parsedEmail = request.body?.email ? validateEmail(request.body.email) : null;
    if (parsedEmail) {
      const user = await User.findOne({ email: parsedEmail });
      if (user && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
        const resetToken = randomBytes(32).toString("hex");
        user.resetTokenHash = createHash("sha256").update(resetToken).digest("hex");
        user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await user.save();

        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
        });
        await transport.sendMail({
          from: process.env.EMAIL_FROM || process.env.SMTP_USER,
          to: user.email,
          subject: "Reset your Atelier password",
          text: `Use this one-time link within 30 minutes: ${config.clientUrl}/reset-password/${resetToken}`,
        });
      }
    }
    response.json({
      data: { message: "If an account exists for that address, you will receive a reset email." },
    });
  }),
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncHandler(async (request, response) => {
    const tokenHash = createHash("sha256").update(request.body.token).digest("hex");
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    }).select("+resetTokenHash +resetTokenExpiresAt +passwordHash");
    if (!user) throw new AppError(400, "This password-reset link is invalid or has expired.");
    await user.setPassword(request.body.password);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    await user.save();
    response.json({ data: { message: "Your password has been reset. You can sign in now." } });
  }),
);

router.patch(
  "/me",
  authenticate,
  asyncHandler(async (request, response) => {
    if (typeof request.body?.name !== "string" || request.body.name.trim().length < 2 || request.body.name.length > 100) {
      throw new AppError(400, "Enter a name between 2 and 100 characters.");
    }
    request.user.name = request.body.name.trim();
    await request.user.save();
    response.json({ data: { user: request.user } });
  }),
);

router.post(
  "/me/addresses",
  authenticate,
  validate(addressSchema),
  asyncHandler(async (request, response) => {
    if (request.user.addresses.length >= 20) {
      throw new AppError(400, "You can save up to 20 delivery addresses.");
    }
    if (request.body.isDefault) request.user.addresses.forEach((item) => { item.isDefault = false; });
    request.user.addresses.push(request.body);
    await request.user.save();
    response.status(201).json({ data: { addresses: request.user.addresses } });
  }),
);

router.delete(
  "/me/addresses/:addressId",
  authenticate,
  asyncHandler(async (request, response) => {
    const address = request.user.addresses.id(request.params.addressId);
    if (!address) throw new AppError(404, "That saved address could not be found.");
    address.deleteOne();
    await request.user.save();
    response.json({ data: { addresses: request.user.addresses } });
  }),
);

router.get(
  "/me/wishlist",
  authenticate,
  asyncHandler(async (request, response) => {
    await request.user.populate({ path: "wishlist", match: { isActive: true }, populate: { path: "category", select: "name slug" } });
    response.json({ data: { products: request.user.wishlist } });
  }),
);

router.put(
  "/me/wishlist/:productId",
  authenticate,
  asyncHandler(async (request, response) => {
    const product = await Product.findOne({ _id: request.params.productId, isActive: true });
    if (!product) throw new AppError(404, "That product could not be found.");
    const exists = request.user.wishlist.some((id) => id.equals(product._id));
    await User.updateOne(
      { _id: request.user._id },
      exists ? { $pull: { wishlist: product._id } } : { $addToSet: { wishlist: product._id } },
    );
    response.json({ data: { saved: !exists } });
  }),
);

router.put(
  "/me/password",
  authenticate,
  asyncHandler(async (request, response) => {
    if (typeof request.body?.currentPassword !== "string" || typeof request.body?.password !== "string") {
      throw new AppError(400, "Enter your current and new passwords.");
    }
    if (
      request.body.password.length < 10 ||
      request.body.password.length > 128 ||
      !/[A-Z]/.test(request.body.password) ||
      !/[a-z]/.test(request.body.password) ||
      !/\d/.test(request.body.password)
    ) {
      throw new AppError(400, "Your new password needs 10 characters, uppercase and lowercase letters, and a number.");
    }
    const user = await User.findById(request.user._id).select("+passwordHash");
    if (!user || !(await user.checkPassword(request.body.currentPassword))) {
      throw new AppError(400, "Your current password is incorrect.");
    }
    await user.setPassword(request.body.password);
    await user.save();
    response.clearCookie(cookieName, { ...sessionCookie, maxAge: undefined });
    response.json({ data: { message: "Your password has changed. Please sign in again." } });
  }),
);

function validateEmail(value) {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return null;
  }
  return value.trim().toLowerCase();
}

export default router;
