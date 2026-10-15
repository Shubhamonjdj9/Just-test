import { json } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config/env.js";
import { protectBrowserMutations } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import commerceRoutes from "./routes/commerce.js";
import contactRoutes from "./routes/contact.js";
import paymentsRoutes from "./routes/payments.js";
import storefrontRoutes from "./routes/storefront.js";
import { AppError } from "./utils/errors.js";

const paymentWebhookPath = "/api/v1/payments/webhook";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.nodeEnv === "production" ? 1 : false);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "img-src": ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://res.cloudinary.com"],
          "script-src": ["'self'", "https://checkout.razorpay.com"],
          "frame-src": ["'self'", "https://checkout.razorpay.com", "https://api.razorpay.com"],
          "connect-src": ["'self'", "https://checkout.razorpay.com", "https://api.razorpay.com"],
          "style-src": ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Idempotency-Key", "X-Requested-With"],
  }));
  app.use(protectBrowserMutations);
  app.use(cookieParser());
  app.use(morgan(config.nodeEnv === "production" ? "combined" : "tiny"));
  app.use(paymentWebhookPath, express.raw({ type: "application/json", limit: "128kb" }));
  const jsonBody = json({ limit: "1mb" });
  app.use((request, _response, next) => {
    if (request.path === paymentWebhookPath && Buffer.isBuffer(request.body)) return next();
    return jsonBody(request, _response, next);
  });
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (request) => request.method === "GET" && request.path.startsWith("/api/v1/products"),
  }));

  const api = express.Router();
  api.get("/health", (_request, response) => response.json({ data: { status: "ok" } }));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });
  api.use("/auth/login", authLimiter);
  api.use("/auth/register", authLimiter);
  api.use("/auth/forgot-password", authLimiter);
  api.use("/auth/reset-password", authLimiter);
  api.use("/auth", authRoutes);
  api.use("/", storefrontRoutes);
  api.use("/", commerceRoutes);
  api.use("/payments", paymentsRoutes);
  api.use("/contact", contactRoutes);
  api.use("/admin", adminRoutes);
  app.use("/api/v1", api);

  app.use((_request, _response, next) => next(new AppError(404, "That page could not be found.")));
  app.use((error, _request, response, _next) => {
    let status = error.status ?? error.statusCode ?? 500;
    let message = error.message ?? "Something went wrong.";
    if (error.code === 11000) {
      status = 409;
      message = "That record already exists.";
    }
    if (error.name === "ValidationError") {
      status = 400;
      message = Object.values(error.errors).map((item) => item.message).join(" ");
    }
    if (error.name === "CastError") {
      status = 400;
      message = "Enter a valid identifier.";
    }
    if (error.code === "LIMIT_FILE_SIZE") {
      status = 413;
      message = "Choose an image smaller than 5 MB.";
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT") {
      status = 400;
      message = "Upload one image at a time.";
    }
    if (error instanceof SyntaxError && "body" in error) {
      status = 400;
      message = "The request body is not valid JSON.";
    }
    if (config.nodeEnv !== "production" && status >= 500) {
      console.error(error);
    }
    response.status(status).json({
      error: { message: status >= 500 && config.nodeEnv === "production" ? "An unexpected server error occurred." : message },
    });
  });

  return app;
}
