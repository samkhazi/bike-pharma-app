import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { jwtVerify, SignJWT } from "jose";
import type { Config } from "./config.js";
import { one, tx, type Db } from "./db.js";
import { normalizePhone } from "./domain.js";
import { AppError, unauthorized } from "./errors.js";
import type { Providers } from "./providers.js";
import { findOrCreateByPhone } from "./services/customers.js";

export type AppEnv = { Variables: { customerId: string } };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function secretKey(config: Config) {
  return new TextEncoder().encode(config.JWT_SECRET);
}

function otpHash(config: Config, phone: string, code: string) {
  return createHmac("sha256", config.JWT_SECRET).update(`${phone}:${code}`).digest("hex");
}

const MAX_CHALLENGES_PER_WINDOW = 5;
const MAX_ATTEMPTS = 5;

export async function requestOtp(db: Db, config: Config, providers: Providers, rawPhone: string, channel: "sms" | "whatsapp") {
  const phone = normalizePhone(rawPhone);
  const recent = await one<{ n: number }>(db, "SELECT count(*) AS n FROM otp_challenges WHERE phone = $1 AND created_at > now() - interval '15 minutes'", [phone]);
  if (recent && recent.n >= MAX_CHALLENGES_PER_WINDOW) throw new AppError(429, "too_many_codes", "Too many codes requested. Try again in a few minutes.");
  const code = !config.isProduction && config.OTP_DEV_CODE ? config.OTP_DEV_CODE : String(randomInt(0, 10_000)).padStart(4, "0");
  await db.query(
    "INSERT INTO otp_challenges (phone, code_hash, channel, expires_at) VALUES ($1, $2, $3, now() + make_interval(secs => $4))",
    [phone, otpHash(config, phone, code), channel, config.OTP_TTL_SECONDS],
  );
  await providers.otp.send(phone, code, channel);
  return { phone, channel, expiresInSeconds: config.OTP_TTL_SECONDS };
}

async function issueSession(client: Parameters<Parameters<typeof tx>[1]>[0], config: Config, customerId: string, userAgent: string | null) {
  const refreshToken = randomBytes(32).toString("base64url");
  await client.query(
    "INSERT INTO auth_sessions (customer_id, refresh_token_hash, user_agent, expires_at) VALUES ($1, $2, $3, now() + make_interval(days => $4))",
    [customerId, sha256(refreshToken), userAgent, config.REFRESH_TOKEN_TTL_DAYS],
  );
  const accessToken = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customerId)
    .setAudience("customer")
    .setIssuedAt()
    .setExpirationTime(`${config.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey(config));
  return { accessToken, refreshToken, expiresInSeconds: config.ACCESS_TOKEN_TTL_SECONDS };
}

export async function verifyOtp(db: Db, config: Config, input: { phone: string; code: string; referralCode?: string }, userAgent: string | null) {
  const phone = normalizePhone(input.phone);
  const challenge = await one<{ id: string; code_hash: string; attempts: number }>(
    db,
    `SELECT id, code_hash, attempts FROM otp_challenges
     WHERE phone = $1 AND consumed_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [phone],
  );
  if (!challenge) throw unauthorized("That code has expired. Ask for a new one.");
  if (challenge.attempts >= MAX_ATTEMPTS) throw new AppError(429, "too_many_attempts", "Too many wrong codes. Ask for a new one.");
  const expected = Buffer.from(challenge.code_hash, "hex");
  const actual = Buffer.from(otpHash(config, phone, input.code), "hex");
  if (!timingSafeEqual(expected, actual)) {
    await db.query("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1", [challenge.id]);
    throw unauthorized("That code is not right");
  }
  return tx(db, async (client) => {
    const consumed = await one<{ id: string }>(
      client,
      "UPDATE otp_challenges SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL AND attempts < $2 RETURNING id",
      [challenge.id, MAX_ATTEMPTS],
    );
    if (!consumed) throw unauthorized("That code has already been used. Ask for a new one.");
    const { customer, isNew } = await findOrCreateByPhone(client, phone, input.referralCode, config.REFERRAL_REWARD);
    const session = await issueSession(client, config, customer.id, userAgent);
    return { ...session, isNewCustomer: isNew, customer };
  });
}

export async function refreshSession(db: Db, config: Config, refreshToken: string, userAgent: string | null) {
  return tx(db, async (client) => {
    const session = await one<{ id: string; customer_id: string }>(
      client,
      `SELECT s.id, s.customer_id FROM auth_sessions s JOIN customers c ON c.id = s.customer_id
       WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND c.deleted_at IS NULL FOR UPDATE OF s`,
      [sha256(refreshToken)],
    );
    if (!session) throw unauthorized();
    await client.query("UPDATE auth_sessions SET revoked_at = now(), last_used_at = now() WHERE id = $1", [session.id]);
    return issueSession(client, config, session.customer_id, userAgent);
  });
}

export async function revokeSession(db: Db, refreshToken: string) {
  await db.query("UPDATE auth_sessions SET revoked_at = now() WHERE refresh_token_hash = $1 AND revoked_at IS NULL", [sha256(refreshToken)]);
}

export function requireCustomer(config: Config): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw unauthorized("Sign in to continue");
    try {
      const { payload } = await jwtVerify(token, secretKey(config), { audience: "customer", algorithms: ["HS256"] });
      if (!payload.sub) throw unauthorized();
      c.set("customerId", payload.sub);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unauthorized();
    }
    await next();
  };
}

export function requireIntegrationKey(config: Config): MiddlewareHandler {
  const keys = config.integrationApiKeys.map((key) => Buffer.from(sha256(key), "hex"));
  return async (c, next) => {
    if (!keys.length) throw new AppError(501, "not_configured", "Set INTEGRATION_API_KEYS to enable the integration API");
    const presented = c.req.header("x-api-key") ?? "";
    const hashed = Buffer.from(sha256(presented), "hex");
    if (!presented || !keys.some((key) => timingSafeEqual(key, hashed))) throw new AppError(401, "invalid_api_key", "Missing or invalid X-Api-Key");
    await next();
  };
}

/** Short-lived token embedded in camera playback URLs, because a <video> element cannot send an Authorization header. */
export async function signCameraToken(config: Config, jobCardId: string) {
  const expiresAt = new Date(Date.now() + config.CAMERA_TOKEN_TTL_SECONDS * 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(jobCardId)
    .setAudience("camera")
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey(config));
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function verifyCameraToken(config: Config, token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey(config), { audience: "camera", algorithms: ["HS256"] });
    if (!payload.sub) throw new Error("no subject");
    return payload.sub;
  } catch {
    throw new AppError(403, "camera_link_expired", "This camera link has expired. Open the booking again.");
  }
}
