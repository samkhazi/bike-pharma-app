import type { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../auth.js";
import type { Config } from "../config.js";
import type { Db } from "../db.js";
import type { Providers } from "../providers.js";
import { ErrorBody } from "../schemas.js";

export type Deps = { db: Db; config: Config; providers: Providers };
export type App = OpenAPIHono<AppEnv>;

export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

export const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } }, required: true },
});

const error = (description: string) => json(ErrorBody, description);

/** The error responses every endpoint can return. Errors always use the Error schema. */
export const errors = {
  400: error("Invalid input (code: validation_failed or a specific code)"),
  401: error("Missing or invalid credentials"),
  404: error("Not found, or not yours"),
  409: error("Conflicts with the current state of the record"),
} as const;

export const bearer = [{ bearerAuth: [] }];
export const apiKey = [{ apiKey: [] }];
