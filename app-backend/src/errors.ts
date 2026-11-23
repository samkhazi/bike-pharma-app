export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 501 | 502;

export class AppError extends Error {
  constructor(
    readonly status: ErrorStatus,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string) => new AppError(400, code, message);
export const unauthorized = (message = "Sign in again") => new AppError(401, "unauthorized", message);
export const notFound = (what: string) => new AppError(404, "not_found", `${what} not found`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const notConfigured = (what: string) => new AppError(501, "not_configured", `${what} is not configured on this server`);

/** Readable one-line description, including connection errors that Node reports as an empty AggregateError. */
export function describeError(error: unknown): string {
  if (error instanceof AggregateError && error.errors.length) return error.errors.map(describeError).join("; ");
  if (error instanceof Error) return error.message || (error as { code?: string }).code || error.name;
  return String(error);
}
