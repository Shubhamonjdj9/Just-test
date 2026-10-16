import "dotenv/config";
import { randomBytes } from "node:crypto";

function validateEnvironment() {
  if (process.env.NODE_ENV === "production" && (process.env.JWT_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters in production.");
  }
  if (process.env.COOKIE_SECURE !== undefined && !["true", "false"].includes(process.env.COOKIE_SECURE)) {
    throw new Error("COOKIE_SECURE must be true or false when set.");
  }
}

export function getConfig() {
  validateEnvironment();
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const jwtSecret = process.env.JWT_SECRET?.trim();
  return {
    nodeEnv,
    cookieSecure: process.env.COOKIE_SECURE === undefined
      ? nodeEnv === "production"
      : process.env.COOKIE_SECURE === "true",
    port: Number(process.env.PORT ?? 4000),
    clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
    mongoUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/atelier_store",
    jwtSecret: jwtSecret || (nodeEnv === "production" ? undefined : randomBytes(48).toString("hex")),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  };
}

export const config = getConfig();
