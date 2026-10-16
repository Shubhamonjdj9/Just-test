import assert from "node:assert/strict";
import test from "node:test";
import { getConfig } from "./env.js";
import { SESSION_DURATION_SECONDS, sessionCookie } from "../middleware/auth.js";

test("defaults secure cookies to production mode and validates explicit overrides", () => {
  const keys = ["NODE_ENV", "JWT_SECRET", "COOKIE_SECURE"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-only-secret-that-is-long-enough-for-this-check";
    process.env.COOKIE_SECURE = "";
    assert.throws(() => getConfig(), /COOKIE_SECURE must be true or false/);
    delete process.env.COOKIE_SECURE;
    assert.equal(getConfig().cookieSecure, true);

    process.env.COOKIE_SECURE = "false";
    assert.equal(getConfig().cookieSecure, false);

    process.env.COOKIE_SECURE = "true";
    assert.equal(getConfig().cookieSecure, true);

    process.env.COOKIE_SECURE = "sometimes";
    assert.throws(() => getConfig(), /COOKIE_SECURE must be true or false/);

    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "";
    delete process.env.COOKIE_SECURE;
    assert.equal(getConfig().jwtSecret.length, 96);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("sets login token and cookie lifetime to two days", () => {
  assert.equal(SESSION_DURATION_SECONDS, 2 * 24 * 60 * 60);
  assert.equal(sessionCookie.maxAge, 2 * 24 * 60 * 60 * 1000);
});
