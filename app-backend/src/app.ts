import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import type { AppEnv } from "./auth.js";
import type { Config } from "./config.js";
import { isUniqueViolation } from "./db.js";
import { AppError } from "./errors.js";
import { registerCustomerRoutes } from "./routes/customer.js";
import { registerIntegrationRoutes } from "./routes/integration.js";
import type { Deps } from "./routes/shared.js";
import { registerSystemRoutes } from "./routes/system.js";

export function openApiDocument(config: Config) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Bike Surgeon API",
      version: "1.0.0",
      description:
        "Customer API (/v1, bearer token from OTP login) for the Bike Surgeon app, and Integration API (/integration/v1, X-Api-Key) " +
        "for the workshop's CRM/ERP. Money is in Indian rupees; estimates are before GST. See docs/ in the repository for guides.",
    },
    servers: [{ url: config.PUBLIC_BASE_URL }],
  };
}

const PG_INPUT_ERRORS: Record<string, string> = {
  "23503": "A referenced record does not exist",
  "23514": "A value is outside the allowed range",
  "22P02": "A value has the wrong format",
  "22007": "A date or time has the wrong format",
};

export function createApp(deps: Deps) {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "validation_failed", message: "Some fields are missing or invalid", issues: result.error.issues } }, 400);
      }
    },
  });

  app.use("/v1/*", cors({ origin: deps.config.corsOrigins, allowHeaders: ["authorization", "content-type"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"], maxAge: 600 }));

  app.onError((error, c) => {
    if (error instanceof AppError) return c.json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof HTTPException) return c.json({ error: { code: "bad_request", message: error.message || "Bad request" } }, error.status);
    if (isUniqueViolation(error)) return c.json({ error: { code: "conflict", message: "That record already exists" } }, 409);
    const pgCode = (error as { code?: string }).code;
    if (pgCode && PG_INPUT_ERRORS[pgCode]) return c.json({ error: { code: "invalid_value", message: PG_INPUT_ERRORS[pgCode] } }, 400);
    console.error(error);
    return c.json({ error: { code: "internal_error", message: "Something went wrong" } }, 500);
  });

  app.notFound((c) => c.json({ error: { code: "not_found", message: `No route for ${c.req.method} ${c.req.path}` } }, 404));

  registerSystemRoutes(app, deps);
  registerCustomerRoutes(app, deps);
  registerIntegrationRoutes(app, deps);

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "accessToken from POST /v1/auth/otp/verify",
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "apiKey", {
    type: "apiKey",
    in: "header",
    name: "X-Api-Key",
    description: "One of the keys in INTEGRATION_API_KEYS",
  });

  app.doc31("/openapi.json", openApiDocument(deps.config));
  app.get("/docs", swaggerUI({ url: "/openapi.json" }));
  return app;
}
