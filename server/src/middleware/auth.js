import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { User } from "../models/index.js";
import { AppError, asyncHandler } from "../utils/errors.js";

export const SESSION_DURATION_SECONDS = 2 * 24 * 60 * 60;

export const sessionCookie = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: config.cookieSecure ? "none" : "lax",
  path: "/",
  maxAge: SESSION_DURATION_SECONDS * 1000,
};

export const authenticate = asyncHandler(async (request, _response, next) => {
  const token = request.cookies?.atelier_session;
  if (!token) {
    throw new AppError(401, "Please sign in to continue.");
  }

  let claims;
  try {
    claims = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new AppError(401, "Your session has expired. Please sign in again.");
  }

  const user = await User.findById(claims.sub);
  if (!user) {
    throw new AppError(401, "Your session is no longer valid.");
  }

  request.user = user;
  next();
});

export function requireAdmin(request, _response, next) {
  if (request.user?.role !== "admin") {
    return next(new AppError(403, "Administrator access is required."));
  }
  next();
}

export function protectBrowserMutations(request, _response, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method) || !request.headers.origin) {
    return next();
  }
  if (request.headers.origin !== config.clientUrl) {
    return next(new AppError(403, "This request origin is not allowed."));
  }
  next();
}
