import type { Page } from "playwright";
import { getCredentials, getCurrentAppConfig, timeouts, retries, useSameCredentials } from "./config";

async function attemptLogin(page: Page, baseUrl: string, envName: string): Promise<void> {
  const loginUrl = `${baseUrl}/login`;
  const appConfig = getCurrentAppConfig();
  const credentials = getCredentials(envName);
  
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
    page.waitForURL("**/plan/**", { timeout: timeouts.loginRedirect }),
    page.waitForSelector(appConfig.readySelector, {
      timeout: timeouts.loginRedirect,
    }),
  ]);
  console.log("  Logged in, redirected from login");

  // Navigate to app-specific landing page
  const landingPage = appConfig.fallbackPages[0]; // First fallback is typically dashboard
  if (landingPage && appConfig.pathPrefix) {
    console.log(`  Navigating to ${landingPage}...`);
    await page.goto(`${baseUrl}${landingPage}`, {
      waitUntil: "domcontentloaded",
      timeout: timeouts.loginNavigation,
    });

    // Wait for SPA content to render
    try {
      await page.waitForSelector(appConfig.readySelector, {
        timeout: timeouts.contentReady,
      });
    } catch {
      console.warn(`  Warning: ${appConfig.displayName} may not have fully loaded`);
    }
    console.log(`  On ${appConfig.displayName} landing page`);
  }
}

export async function login(page: Page, baseUrl: string, envName: string = "dev"): Promise<void> {
  const maxAttempts = 1 + retries.login;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`  Login retry ${attempt}/${maxAttempts}...`);
        await page.waitForTimeout(2000);
      }
      await attemptLogin(page, baseUrl, envName);
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

/**
 * Logout from current session
 * Needed when switching environments with same credentials
 */
export async function logout(page: Page, baseUrl: string): Promise<void> {
  console.log("  Logging out...");
  
  // Try navigating to logout endpoint
  try {
    await page.goto(`${baseUrl}/logout`, {
      waitUntil: "domcontentloaded",
      timeout: timeouts.loginNavigation,
    });
  } catch {
    // Logout endpoint might redirect or not exist
  }

  // Clear cookies and storage to ensure clean state
  await page.context().clearCookies();
  
  // Wait a moment for logout to complete
  await page.waitForTimeout(1000);
  console.log("  Logged out and cookies cleared");
}

/**
 * Check if we need to logout before switching to a new environment
 */
export function needsLogoutBeforeSwitch(): boolean {
  return useSameCredentials();
}
