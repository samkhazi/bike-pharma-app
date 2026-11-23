import { badRequest } from "./errors.js";

/** Customer-visible stages, in order. The index is the `stage` number the app's tracker uses. */
export const JOB_STAGES = ["booked", "rider_assigned", "picked_up", "at_workshop", "in_service", "job_closed", "delivered"] as const;
export const JOB_STATUSES = [...JOB_STAGES, "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const OPEN_STATUSES: readonly JobStatus[] = ["booked", "rider_assigned", "picked_up", "at_workshop", "in_service", "job_closed"];
export const CANCELLABLE_BY_CUSTOMER: readonly JobStatus[] = ["booked", "rider_assigned"];
export const CAMERA_STATUSES: readonly JobStatus[] = ["at_workshop", "in_service"];

export function stageOf(status: JobStatus) {
  return status === "cancelled" ? -1 : JOB_STAGES.indexOf(status);
}

export const STATUS_MESSAGES: Record<JobStatus, { title: string; body: (bike: string) => string; screen: string }> = {
  booked: { title: "You’re booked", body: (bike) => `Your ${bike} is booked in.`, screen: "Track + live view" },
  rider_assigned: { title: "A rider is on the way", body: (bike) => `A rider is coming to collect your ${bike}.`, screen: "Track + live view" },
  picked_up: { title: "Bike picked up", body: (bike) => `Your ${bike} is on its way to the workshop.`, screen: "Track + live view" },
  at_workshop: { title: "Checked in at the workshop", body: (bike) => `Your ${bike} is at the workshop.`, screen: "Track + live view" },
  in_service: { title: "Service has started", body: (bike) => `Work on your ${bike} has started.`, screen: "Track + live view" },
  job_closed: { title: "Service complete", body: (bike) => `Your ${bike} is ready. The invoice is in the app.`, screen: "Job card closed + pay" },
  delivered: { title: "Delivered", body: (bike) => `Your ${bike} is back with you.`, screen: "Track + live view" },
  cancelled: { title: "Booking cancelled", body: (bike) => `The booking for your ${bike} was cancelled. Nothing was charged.`, screen: "" },
};

/** Normalises an Indian mobile number to E.164 (+91XXXXXXXXXX). */
export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^[6-9]\d{9}$/.test(national)) throw badRequest("invalid_phone", "Enter a 10-digit Indian mobile number");
  return `+91${national}`;
}

/** Registration plates are stored without spaces or dashes, upper case: "KA 01 MY 4500" -> "KA01MY4500". */
export function normalizePlate(input: string) {
  const plate = input.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(plate)) throw badRequest("invalid_registration", "Enter the number on your plate");
  return plate;
}

/** GST is rounded to the rupee, matching what the app shows. */
export function gstOn(taxable: number, rate: number) {
  return Math.round(taxable * rate);
}

export function money(value: number) {
  return Math.round(value * 100) / 100;
}
