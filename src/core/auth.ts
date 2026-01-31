import type { Page } from "playwright";
import { getCredentials, getCurrentAppConfig, timeouts, retries, useSameCredentials } from "./config";
import { log, style } from "../utils/terminal";

async function attemptLogin(page: Page, baseUrl: string, envName: string): Promise<void> {
  const loginUrl = `${baseUrl}/login`;
  const appConfig = getCurrentAppConfig();
  const credentials = getCredentials(envName);
  
  log.action(`Navigating to ${style.url(loginUrl)}`);
  await page.goto(loginUrl, {
    waitUntil: "domcontentloaded",
    timeout: timeouts.loginNavigation,
  });

  await page.waitForSelector('input[type="email"], input[name="email"]', {
    timeout: timeouts.loginFormReady,
  });

  log.action("Filling credentials...");
  await page.fill('input[type="email"], input[name="email"]', credentials.email);
  await page.fill('input[type="password"], input[name="password"]', credentials.password);

  log.action("Submitting login form...");
  await page.click('button[type="submit"]');

  // Wait for redirect after login (coach or admin)
  await Promise.race([
    page.waitForURL("**/coach/dashboard**", { timeout: timeouts.loginRedirect }),
    page.waitForURL("**/admin/**", { timeout: timeouts.loginRedirect }),
    page.waitForURL("**/plan/**", { timeout: timeouts.loginRedirect }),
    page.waitForSelector(appConfig.readySelector, {
      timeout: timeouts.loginRedirect,
    }),
  ]);  log.success("Logged in successfully");

  // Navigate to app-specific landing page
  const landingPage = appConfig.fallbackPages[0];
  if (landingPage && appConfig.pathPrefix) {
    log.action(`Navigating to ${style.path(landingPage)}...`);
    console.log("");
    
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
      log.warning(`${appConfig.displayName} may not have fully loaded`);
    }
    log.success(`On ${appConfig.displayName} landing page`);
    console.log("");
  }
}

export async function login(page: Page, baseUrl: string, envName: string = "dev"): Promise<void> {
  const maxAttempts = 1 + retries.login;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        log.warning(`Login retry ${attempt}/${maxAttempts}...`);
        await page.waitForTimeout(2000);
      }
      await attemptLogin(page, baseUrl, envName);
      return;
    } catch (err) {
      lastError = err;
      log.error(`Login attempt ${attempt}/${maxAttempts} failed: ${err}`);
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
  log.action("Logging out...");
  
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
  log.success("Logged out and cookies cleared");
}

/**
 * Check if we need to logout before switching to a new environment
 */
export function needsLogoutBeforeSwitch(): boolean {
  return useSameCredentials();
}
