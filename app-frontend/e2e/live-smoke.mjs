// End-to-end check of the app on the real API (run in CI): OTP login, home, live bay camera (HLS), part approval.
// Needs the API on :8080 with the demo seed, and the app built with VITE_API_URL on :5173.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const APP = process.env.APP_URL ?? "http://localhost:5173";
const SHOTS = process.env.SHOTS ?? "../e2e-shots";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const problems = [];
page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") problems.push(`console: ${message.text()}`);
});

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    await page.screenshot({ path: `${SHOTS}/failed-${name.replace(/\W+/g, "-")}.png` }).catch(() => {});
    console.log(`FAIL ${name}: ${error.message}`);
    problems.push(`step failed: ${name}`);
    throw error;
  }
};

try {
  await step("splash and login screen", async () => {
    await page.goto(APP);
    await page.getByLabel("Skip intro").click();
    await page.getByText("Mobile number").waitFor();
  });
  await step("OTP is sent by the API", async () => {
    // Typed on the app's own keypad, like on a phone. The field is read-only so the phone's keyboard stays closed.
    const field = page.locator('input[type="tel"]');
    await field.click();
    if ((await field.getAttribute("readonly")) === null) throw new Error("phone field is not read-only");
    for (const key of "9876543219") await page.getByRole("button", { name: key, exact: true }).click();
    await field.press("Backspace"); // a computer keyboard still types
    await field.press("0");
    const typed = await field.inputValue();
    if (typed !== "98765 43210") throw new Error(`phone field shows "${typed}"`);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Enter the code").waitFor();
    await page.getByText("Sent to +91 98765 43210").waitFor();
  });
  await step("code 4719 logs in and opens Home", async () => {
    for (const key of "4719") await page.getByRole("button", { name: key, exact: true }).click();
    await page.getByText("Sanath", { exact: true }).waitFor({ timeout: 15000 });
    await page.getByLabel(/Wallet, ₹420/).waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/1-home.png` });
  });
  await step("live bay camera plays through the API (HLS)", async () => {
    await page.getByRole("button", { name: /WATCH LIVE/ }).first().click();
    await page.locator(".cx-feed video").waitFor();
    await page.waitForFunction(() => {
      const video = document.querySelector(".cx-feed video");
      return video && video.readyState >= 2 && video.currentTime > 0.2;
    }, null, { timeout: 30000 });
    await page.getByText("Bay 03").first().waitFor();
    await page.screenshot({ path: `${SHOTS}/2-tracker-camera.png` });
  });
  await step("part approval is saved on the server", async () => {
    await page.getByRole("button", { name: /Review/ }).first().click();
    await page.getByText("Parts from the bay").waitFor();
    await page.getByRole("button", { name: "Approve", exact: true }).first().click();
    await page.waitForTimeout(2500);
    await page.reload();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/3-after-approval.png` });
    const token = await page.evaluate(() => localStorage.getItem("bs.api.access"));
    const response = await fetch("http://localhost:8080/v1/bookings", { headers: { authorization: `Bearer ${token}` } });
    const bookings = await response.json();
    const approved = bookings.flatMap((b) => b.extras).filter((e) => e.status === "approved").length;
    if (approved < 1) throw new Error("no approved extra on the server");
  });
  await step("garage, payment history and notifications open", async () => {
    await page.goto(APP);
    await page.getByLabel(/Wallet, ₹/).waitFor({ timeout: 15000 });
    await page.getByLabel(/notifications/i).first().click();
    await page.getByText(/new|up to date/).first().waitFor();
    await page.screenshot({ path: `${SHOTS}/4-notifications.png` });
  });
} finally {
  await browser.close();
}

const real = problems.filter((text) => !/favicon|ERR_ABORTED|Failed to load resource: the server responded with a status of 409/.test(text));
if (real.length) {
  console.log("PROBLEMS:\n" + real.join("\n"));
  process.exit(1);
}
console.log("E2E OK");
