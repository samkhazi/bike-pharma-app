/**
 * Bike Pharma Cloud Functions (region asia-south1 / Mumbai).
 * Global options (region) are set in ./config, which every function imports.
 */
export { lookupVehicle } from "./functions/lookupVehicle";
export { placeOrder, verifyPayment, razorpayWebhook } from "./functions/orders";
export { createMechanic } from "./functions/createMechanic";
