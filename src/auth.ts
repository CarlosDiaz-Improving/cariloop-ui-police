import type { Page } from "playwright";
import { credentials, timeouts, retries } from "./config";

async function attemptLogin(page: Page, baseUrl: string): Promise<void> {
  const loginUrl = `${baseUrl}/login`;
  console.log(`  Navigating to ${loginUrl}`);
  await page.goto(loginUrl, {
    waitUntil: "domcontentloaded",
    timeout: timeouts.loginNavigation,
  });

  await page.waitForSelector('input[type="email"], input[name="email"]', {
    timeout: timeouts.loginFormReady,
  });

  console.log("  Filling credentials...");
  await page.fill('input[type="email"], input[name="email"]', credentials.email);
  await page.fill('input[type="password"], input[name="password"]', credentials.password);

  console.log("  Submitting login form...");
  await page.click('button[type="submit"]');

  // Wait for redirect after login (coach or admin)
  await Promise.race([
    page.waitForURL("**/coach/dashboard**", { timeout: timeouts.loginRedirect }),
    page.waitForURL("**/admin/**", { timeout: timeouts.loginRedirect }),
    page.waitForSelector('a[href*="/admin"]', {
      timeout: timeouts.loginRedirect,
    }),
  ]);
  console.log("  Logged in, redirected from login");

  // Navigate to admin dashboard
  console.log("  Navigating to /admin/dashboard...");
  await page.goto(`${baseUrl}/admin/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: timeouts.loginNavigation,
  });

  // Wait for SPA content to render (sidebar nav links)
  try {
    await page.waitForSelector('a[href*="/admin"]', {
      timeout: timeouts.contentReady,
    });
  } catch {
    console.warn("  Warning: admin sidebar may not have fully loaded");
  }
  console.log("  On admin dashboard");
}

export async function login(page: Page, baseUrl: string): Promise<void> {
  const maxAttempts = 1 + retries.login;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`  Login retry ${attempt}/${maxAttempts}...`);
        await page.waitForTimeout(2000);
      }
      await attemptLogin(page, baseUrl);
      return;
    } catch (err) {
      lastError = err;
      console.error(`  Login attempt ${attempt}/${maxAttempts} failed: ${err}`);
    }
  }

  throw new Error(
    `Login failed after ${maxAttempts} attempts for ${baseUrl}: ${lastError}`
  );
}
