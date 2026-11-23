import { z } from "zod";

const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8080),
    PUBLIC_BASE_URL: z.url().default("http://localhost:8080"),
    CORS_ORIGINS: z.string().default("http://localhost:5173,capacitor://localhost,https://localhost"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required, e.g. postgres://user:pass@host:5432/db"),
    DB_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/, "DB_SCHEMA must be a lowercase identifier").default("public"),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    DB_SSL: z.enum(["off", "require", "no-verify"]).default("off"),

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(60),

    WORKSHOP_CODE: z.string().default("DVG-01"),
    GST_RATE: z.coerce.number().min(0).max(1).default(0.18),
    REFERRAL_REWARD: z.coerce.number().min(0).default(200),
    TIMEZONE: z.string().default("Asia/Kolkata"),

    OTP_PROVIDER: z.enum(["console", "http"]).default("console"),
    OTP_HTTP_URL: z.url().optional(),
    OTP_HTTP_TOKEN: z.string().optional(),
    OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    OTP_DEV_CODE: z.string().regex(/^\d{4}$/).optional(),

    PUSH_PROVIDER: z.enum(["none", "onesignal"]).default("none"),
    ONESIGNAL_APP_ID: z.string().optional(),
    ONESIGNAL_API_KEY: z.string().optional(),

    VEHICLE_LOOKUP_URL: z.url().optional(),
    VEHICLE_LOOKUP_TOKEN: z.string().optional(),

    INTEGRATION_API_KEYS: z.string().default(""),
    WEBHOOK_URL: z.url().optional(),
    WEBHOOK_SECRET: z.string().optional(),
    WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(3000),

    CAMERA_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),

    // Workshop bridge (src/bridge): the old billing MySQL and the Bike Surgeon Inventory. Off until BRIDGE=on.
    BRIDGE: z.enum(["off", "on"]).default("off"),
    BRIDGE_INTERVAL_MS: z.coerce.number().int().min(5000).default(20000),
    OLD_DB_HOST: z.string().default("127.0.0.1"),
    OLD_DB_PORT: z.string().default("3306"),
    OLD_DB_USER: z.string().optional(),
    OLD_DB_PASS: z.string().optional(),
    OLD_DB_BS: z.string().default("bikesurgeonoff"),
    OLD_DB_PUBKEY: z.enum(["0", "1"]).default("1"),
    MYSQL_BIN: z.string().default("mysql"),
    // on = app bookings are also written to the old site's booking list (a_service_bookings), so reception sees them.
    OLD_DB_WRITE: z.enum(["off", "on"]).default("off"),
    OLD_DB_WRITE_USER: z.string().optional(),
    OLD_DB_WRITE_PASS: z.string().optional(),
    // on = a customer's old wallet balance is copied once, the first time they log in to this app.
    BRIDGE_IMPORT_WALLET: z.enum(["off", "on"]).default("on"),
    INVENTORY_URL: z.url().optional(),
    INVENTORY_FEED_KEY: z.string().optional(),
    INVENTORY_STORE: z.enum(["BS", "ML", "BP"]).default("BS"),
  })
  .superRefine((env, ctx) => {
    const fail = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (env.OTP_PROVIDER === "http" && !env.OTP_HTTP_URL) fail("OTP_HTTP_URL", "required when OTP_PROVIDER=http");
    if (env.PUSH_PROVIDER === "onesignal" && (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_API_KEY)) {
      fail("ONESIGNAL_APP_ID", "ONESIGNAL_APP_ID and ONESIGNAL_API_KEY are required when PUSH_PROVIDER=onesignal");
    }
    if (env.WEBHOOK_URL && !env.WEBHOOK_SECRET) fail("WEBHOOK_SECRET", "required when WEBHOOK_URL is set");
    if (env.BRIDGE === "on" && !env.OLD_DB_USER) fail("OLD_DB_USER", "required when BRIDGE=on (the read-only login of the old billing database)");
    if (env.INVENTORY_URL && !env.INVENTORY_FEED_KEY) fail("INVENTORY_FEED_KEY", "required when INVENTORY_URL is set (the Inventory's FEED_KEY)");
    if (env.NODE_ENV === "production") {
      if (env.OTP_DEV_CODE) fail("OTP_DEV_CODE", "must not be set in production");
      if (env.OTP_PROVIDER === "console") fail("OTP_PROVIDER", "console only prints codes to the log; use http in production");
      if (list(env.INTEGRATION_API_KEYS).some((key) => key.length < 24)) fail("INTEGRATION_API_KEYS", "each key must be at least 24 characters");
    }
  });

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env) {
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ""));
  const parsed = schema.safeParse(present);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid configuration:\n${lines.join("\n")}`);
  }
  const env = parsed.data;
  return {
    ...env,
    corsOrigins: list(env.CORS_ORIGINS),
    integrationApiKeys: list(env.INTEGRATION_API_KEYS),
    isProduction: env.NODE_ENV === "production",
  };
}
