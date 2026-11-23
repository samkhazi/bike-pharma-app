import type { Config } from "./config.js";
import { AppError, notConfigured } from "./errors.js";

/**
 * Pluggable outbound integrations. Each one is chosen by environment variables, so swapping the SMS gateway,
 * push provider or RC lookup service never touches the routes.
 */
export type Providers = {
  otp: { send(phone: string, code: string, channel: "sms" | "whatsapp"): Promise<void> };
  push: { send(target: { customerId: string; tokens: { provider: string; token: string }[] }, message: { title: string; body: string; data: Record<string, string> }): Promise<void> };
  vehicleLookup: { lookup(registrationNumber: string): Promise<VehicleLookupResult | null> };
};

export type VehicleLookupResult = {
  registrationNumber: string;
  make: string | null;
  model: string | null;
  bodyType: null;
  colourName: string | null;
  makeYear: number | null;
  chassisLast4: string | null;
};

async function postJson(url: string, token: string | undefined, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new AppError(502, "upstream_failed", `${new URL(url).host} answered ${response.status}`);
  return response;
}

export function createProviders(config: Config): Providers {
  const otp: Providers["otp"] =
    config.OTP_PROVIDER === "http"
      ? { send: async (phone, code, channel) => void (await postJson(config.OTP_HTTP_URL!, config.OTP_HTTP_TOKEN, { phone, code, channel, purpose: "login" })) }
      : { send: async (phone, code, channel) => console.info(`[otp] ${channel} code for ${phone}: ${code}`) };

  const push: Providers["push"] =
    config.PUSH_PROVIDER === "onesignal"
      ? {
          async send(target, message) {
            const subscriptions = target.tokens.filter((t) => t.provider === "onesignal").map((t) => t.token);
            if (!subscriptions.length) return;
            const response = await fetch("https://api.onesignal.com/notifications", {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Key ${config.ONESIGNAL_API_KEY}` },
              body: JSON.stringify({
                app_id: config.ONESIGNAL_APP_ID,
                include_subscription_ids: subscriptions,
                headings: { en: message.title },
                contents: { en: message.body },
                data: message.data,
              }),
              signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok) throw new Error(`OneSignal answered ${response.status}: ${await response.text()}`);
          },
        }
      : { send: async () => {} };

  const vehicleLookup: Providers["vehicleLookup"] = config.VEHICLE_LOOKUP_URL
    ? {
        async lookup(registrationNumber) {
          const response = await fetch(`${config.VEHICLE_LOOKUP_URL}?registration=${encodeURIComponent(registrationNumber)}`, {
            headers: config.VEHICLE_LOOKUP_TOKEN ? { authorization: `Bearer ${config.VEHICLE_LOOKUP_TOKEN}` } : {},
            signal: AbortSignal.timeout(10_000),
          });
          if (response.status === 404) return null;
          if (!response.ok) throw new AppError(502, "upstream_failed", `Vehicle lookup answered ${response.status}`);
          const data = (await response.json()) as Partial<VehicleLookupResult>;
          return {
            registrationNumber,
            make: data.make ?? null,
            model: data.model ?? null,
            bodyType: null,
            colourName: data.colourName ?? null,
            makeYear: data.makeYear ?? null,
            chassisLast4: data.chassisLast4 ?? null,
          };
        },
      }
    : {
        async lookup() {
          throw notConfigured("Vehicle lookup (VEHICLE_LOOKUP_URL)");
        },
      };

  return { otp, push, vehicleLookup };
}
