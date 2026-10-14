import mongoose from "mongoose";
import { z } from "zod";
import { config } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { User } from "./models/index.js";

const credentials = z.object({
  email: z.email().max(254),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/\d/),
});

try {
  const parsed = credentials.safeParse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD with 12+ characters, uppercase and lowercase letters, and a number.");
  }
  await connectDatabase(config.mongoUri);
  const email = parsed.data.email.toLowerCase();
  const existing = await User.findOne({ email }).select("+passwordHash");
  if (existing) {
    if (existing.role === "admin") throw new Error("An administrator already exists for this email. Nothing has been changed.");
    throw new Error("This email already belongs to a customer. No role was changed; choose a new administrator email.");
  }
  const admin = new User({ name: "Store administrator", email, role: "admin" });
  await admin.setPassword(parsed.data.password);
  await admin.save();
  console.info("Administrator account created. The password was not displayed or saved in the application repository.");
} catch (error) {
  console.error("The administrator account was not created:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
