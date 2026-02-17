import type { Page } from "playwright";
import { log, style, symbols } from "../../utils/terminal";
import { optionalEnv } from "../../utils/env";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getScreenshotsDir } from "../../core/config";

/**
 * Registration flow for cariloop-auth.
 * 
 * Modes:
 * - "screenshot-only": Fill the form and capture screenshots without submitting.
 * - "full-flow": Actually submit the registration, consuming a test user.
 * 
 * Controlled via env var: AUTH_REGISTRATION_MODE=screenshot-only|full-flow
 */

// Test user pool — eligible users that can be consumed by registration
const TEST_USER_POOL = [
  "amd+fred01@mailinator.com",
  "amd+fred02@mailinator.com",
  "amd+fred03@mailinator.com",
  "amd+fred04@mailinator.com",
  "amd+fred05@mailinator.com",
  "amd+fred06@mailinator.com",
  "amd+fred07@mailinator.com",
  "amd+fred08@mailinator.com",
  "amd+fred09@mailinator.com",
  "amd+fred10@mailinator.com",
];

const REGISTRATION_PASSWORD = "Ca.123123";

interface UserPoolState {
  consumed: string[];
  lastConsumedAt?: string;
}

function getPoolFilePath(): string {
  return path.join(getScreenshotsDir(), "user-pool.json");
}

function loadPoolState(): UserPoolState {
  const filePath = getPoolFilePath();
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      return { consumed: [] };
    }
  }
  return { consumed: [] };
}

function savePoolState(state: UserPoolState): void {
  const filePath = getPoolFilePath();
  writeFileSync(filePath, JSON.stringify(state, null, 2));
}

function getNextAvailableUser(): string | null {
  const state = loadPoolState();
  const available = TEST_USER_POOL.filter((email) => !state.consumed.includes(email));
  return available[0] ?? null;
}

function markUserConsumed(email: string): void {
  const state = loadPoolState();
  if (!state.consumed.includes(email)) {
    state.consumed.push(email);
    state.lastConsumedAt = new Date().toISOString();
    savePoolState(state);
  }
}

export type RegistrationMode = "screenshot-only" | "full-flow" | "disabled";

export function getRegistrationMode(): RegistrationMode {
  const mode = optionalEnv("AUTH_REGISTRATION_MODE") ?? "screenshot-only";
  if (mode === "full-flow" || mode === "screenshot-only") return mode;
  if (mode === "disabled" || mode === "none" || mode === "off") return "disabled";
  return "screenshot-only";
}

export function getAvailableTestUsers(): { total: number; available: number; consumed: string[] } {
  const state = loadPoolState();
  const available = TEST_USER_POOL.filter((email) => !state.consumed.includes(email));
  return {
    total: TEST_USER_POOL.length,
    available: available.length,
    consumed: state.consumed,
  };
}

/**
 * Capture registration flow screenshots.
 * 
 * Flow:
 * 1. Clear introductionSeen → navigate to /register → capture onboarding intro slides
 * 2. Set introductionSeen → reload → capture registration form
 * 3. (screenshot-only) Fill form + capture without submitting
 * 4. (full-flow) Fill form + submit using a test user from the pool
 */
export async function captureRegistrationFlow(
  page: Page,
  baseUrl: string,
  outputDir: string,
): Promise<{ screenshots: string[]; userConsumed: string | null }> {
  const mode = getRegistrationMode();
  const screenshots: string[] = [];

  if (mode === "disabled") {
    log.action("Registration flow disabled (AUTH_REGISTRATION_MODE=disabled)");
    return { screenshots, userConsumed: null };
  }

  log.header("Registration Flow");
  console.log(`  Mode: ${style.highlight(mode)}\n`);

  // ── Phase 1: Capture onboarding introduction slides ──
  // Clear introductionSeen so the intro carousel shows
  await page.evaluate(() => localStorage.removeItem("cariloop:introductionSeen"));

  await page.goto(`${baseUrl}/register`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2500);

  const introScreenshots = await captureIntroSlides(page, outputDir);
  screenshots.push(...introScreenshots);

  // ── Phase 2: Set introductionSeen and navigate to registration form ──
  await page.evaluate(() => localStorage.setItem("cariloop:introductionSeen", "true"));

  await page.goto(`${baseUrl}/register`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2500);

  if (mode === "screenshot-only") {
    const formScreenshots = await captureScreenshotOnly(page, outputDir);
    screenshots.push(...formScreenshots.screenshots);
    return { screenshots, userConsumed: null };
  }

  // full-flow mode
  const fullResult = await captureFullFlow(page, baseUrl, outputDir);
  screenshots.push(...fullResult.screenshots);
  return { screenshots, userConsumed: fullResult.userConsumed };
}

/**
 * Capture the 7 onboarding intro slides.
 * Slides: Welcome, Coaching, Tools, Community, Resources, Security, Ready
 *
 * Button layout:
 *   Desktop (desktop-introduction.component.html):
 *     - Slide 0 (Welcome):  button.black-button "Get Started" (parent div visible)
 *     - Slides 1-5:         button.transparent-button "Next" (standalone, visible)
 *     - Slide 6 (Ready):    button.black-button "Create Account" (parent div visible)
 *     Hidden state: parent div or button itself gets CSS class "hide-element"
 *
 *   Mobile (mobile-introduction.component.html):
 *     - ALL slides rendered in DOM via *ngFor, only active one has .active class
 *     - Slides 0,6: button.black-button inside .buttons-container (*ngIf)
 *     - Slides 1-5: button.transparent-button (*ngIf)
 *
 * Uses Playwright :visible pseudo-class to correctly resolve which button
 * is actually visible (handles hide-element, *ngIf, inactive slides).
 */
async function captureIntroSlides(
  page: Page,
  outputDir: string,
): Promise<string[]> {
  const screenshots: string[] = [];

  const SLIDE_NAMES = [
    "welcome",
    "coaching",
    "tools",
    "community",
    "resources",
    "security",
    "ready",
  ];

  // Check if the intro carousel is present
  const introCount = await page.locator(
    "app-desktop-introduction, app-mobile-introduction, app-introduction"
  ).count();
  if (introCount === 0) {
    log.warning("Intro carousel not found — skipping intro slide capture");
    return screenshots;
  }

  log.step("Capturing onboarding intro slides...");

  for (let i = 0; i < SLIDE_NAMES.length; i++) {
    const slideName = SLIDE_NAMES[i]!;
    const filename = `register__intro-${String(i).padStart(2, "0")}-${slideName}.png`;
    const filepath = path.join(outputDir, filename);

    await page.waitForTimeout(500);
    await page.screenshot({ path: filepath, fullPage: true });
    screenshots.push(filepath);
    log.fileSaved(filename);

    // Advance to the next slide (except on the last slide)
    if (i < SLIDE_NAMES.length - 1) {
      try {
        // Playwright's :visible pseudo-class checks computed visibility
        // (display, visibility, opacity, parent chain) — handles both
        // desktop hide-element class and mobile *ngIf / .active patterns.
        const advanceBtn = page.locator(
          "button.black-button:visible, button.transparent-button:visible"
        ).first();

        await advanceBtn.click({ timeout: 5000 });
        // Wait for slide transition animation + render
        await page.waitForTimeout(700);
      } catch (err) {
        log.warning(`Could not advance past slide ${i} (${slideName}): ${err}`);
        break;
      }
    }
  }

  // Capture the "Skip introduction" link if visible (only on slides 1-5)
  try {
    const skipLocator = page.locator("button.skip-introduction:visible");
    if (await skipLocator.count() > 0) {
      const skipFilename = "register__intro-skip-button.png";
      const skipPath = path.join(outputDir, skipFilename);
      await page.screenshot({ path: skipPath, fullPage: true });
      screenshots.push(skipPath);
      log.fileSaved(skipFilename);
    }
  } catch {
    // Skip button might not be visible on the current (last) slide
  }

  log.success(`Intro slides captured (${screenshots.length} images)`);
  return screenshots;
}

async function captureScreenshotOnly(
  page: Page,
  outputDir: string,
): Promise<{ screenshots: string[]; userConsumed: null }> {
  const screenshots: string[] = [];

  // Step 1: Empty form screenshot (introductionSeen is already set at this point)
  const emptyPath = path.join(outputDir, "register__empty-form.png");
  await page.screenshot({ path: emptyPath, fullPage: true });
  screenshots.push(emptyPath);
  log.fileSaved("register__empty-form.png");

  // Step 2: Fill all fields
  try {
    await fillRegistrationForm(page, {
      firstName: "Test 01",
      lastName: "Fred",
      email: "demo+test@example.com",
      password: REGISTRATION_PASSWORD,
    });
  } catch (err) {
    log.error(`Failed to fill registration form: ${err}`);
    return { screenshots, userConsumed: null };
  }

  // Step 3: Select personal email type radio button
  try {
    await page.click('mat-radio-button[value="personal"]', { timeout: 3000 });
    await page.waitForTimeout(300);
  } catch {
    // Radio might not be visible yet
  }

  // Step 4: Filled form screenshot (before submit)
  const filledPath = path.join(outputDir, "register__filled-form.png");
  await page.waitForTimeout(500);
  await page.screenshot({ path: filledPath, fullPage: true });
  screenshots.push(filledPath);
  log.fileSaved("register__filled-form.png");

  // Step 5: Trigger validation by submitting empty form (reload first)
  await page.evaluate(() => localStorage.setItem("cariloop:introductionSeen", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  
  try {
    // Click submit without filling to trigger validation
    const submitBtn = await page.$('c-button[type="submit"] button, button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(500);
    }
  } catch {
    // Validation click might fail
  }

  const validationPath = path.join(outputDir, "register__validation-errors.png");
  await page.screenshot({ path: validationPath, fullPage: true });
  screenshots.push(validationPath);
  log.fileSaved("register__validation-errors.png");

  log.success(`Registration form screenshots captured (${screenshots.length} images, no user consumed)`);
  return { screenshots, userConsumed: null };
}

/**
 * Post-registration steps (from register.component.html ngSwitch):
 *   1. create-account      → account-creation form (already captured before submit)
 *   2. email-verification  → 6-digit code input (requires real code from email)
 *   3. backup-contact      → phone + optional email form
 *   4. eligibility-check   → work email or personal info verification
 *   5. mfa-setup           → two-step verification button + modal
 *
 * Which steps appear depends on the account state after registration.
 * We capture each step as it appears, advancing where possible.
 */
const REGISTRATION_STEPS = [
  {
    name: "email-verification",
    selector: "app-email-verification",
    description: "Email Verification (6-digit code)",
  },
  {
    name: "backup-contact",
    selector: "app-backup-contact",
    description: "Backup Contact (phone/email)",
  },
  {
    name: "eligibility-check",
    selector: "app-eligibility-check",
    description: "Eligibility Check (work email / personal info)",
  },
  {
    name: "mfa-setup",
    selector: "app-two-step-verification",
    description: "Two-Step Verification (MFA)",
  },
];

async function captureFullFlow(
  page: Page,
  baseUrl: string,
  outputDir: string,
): Promise<{ screenshots: string[]; userConsumed: string | null }> {
  const screenshots: string[] = [];

  // Get next available test user
  const email = getNextAvailableUser();
  if (!email) {
    log.error("No test users available! All 10 fred users have been consumed.");
    log.action("Reset the user pool by deleting screenshots/cariloop-auth/user-pool.json");
    return { screenshots, userConsumed: null };
  }

  const poolInfo = getAvailableTestUsers();
  console.log(`  ${symbols.bullet} Using test user: ${style.highlight(email)}`);
  console.log(`  ${symbols.bullet} Remaining after this: ${style.count((poolInfo.available - 1).toString())}/${poolInfo.total}\n`);

  // ── Step 1: Capture empty form ──
  const emptyPath = path.join(outputDir, "register__step-01-empty-form.png");
  await page.screenshot({ path: emptyPath, fullPage: true });
  screenshots.push(emptyPath);
  log.fileSaved("register__step-01-empty-form.png");

  // ── Step 2: Fill the form with real test user data ──
  try {
    await fillRegistrationForm(page, {
      firstName: "Test 01",
      lastName: "Fred",
      email,
      password: REGISTRATION_PASSWORD,
    });
  } catch (err) {
    log.error(`Failed to fill registration form: ${err}`);
    return { screenshots, userConsumed: null };
  }

  // Select personal email type
  try {
    await page.click('mat-radio-button[value="personal"]', { timeout: 3000 });
    await page.waitForTimeout(300);
  } catch {
    // Radio might not be visible
  }

  // Accept terms
  try {
    await page.click('mat-checkbox', { timeout: 3000 });
    await page.waitForTimeout(300);
  } catch {
    // Checkbox might not be visible
  }

  // ── Step 3: Capture filled form before submit ──
  const filledPath = path.join(outputDir, "register__step-02-filled-form.png");
  await page.waitForTimeout(500);
  await page.screenshot({ path: filledPath, fullPage: true });
  screenshots.push(filledPath);
  log.fileSaved("register__step-02-filled-form.png");

  // ── Step 4: Submit the form ──
  log.action("Submitting registration form...");
  try {
    await page.click('c-button[type="submit"] button, button[type="submit"]', { timeout: 5000 });
    // Wait for API call + Angular to render the next step
    await page.waitForTimeout(6000);
  } catch (err) {
    log.error(`Failed to submit registration: ${err}`);
    return { screenshots, userConsumed: null };
  }

  // Mark user as consumed immediately after submit
  markUserConsumed(email);

  // ── Step 5: Capture each post-registration step as it appears ──
  let stepNumber = 3;
  for (const step of REGISTRATION_STEPS) {
    try {
      const stepElement = await page.$(step.selector);
      if (!stepElement) continue;

      const isVisible = await stepElement.isVisible();
      if (!isVisible) continue;

      const paddedNum = String(stepNumber).padStart(2, "0");
      const filename = `register__step-${paddedNum}-${step.name}.png`;
      const filepath = path.join(outputDir, filename);

      log.step(`Detected step: ${step.description}`);
      await page.waitForTimeout(500);
      await page.screenshot({ path: filepath, fullPage: true });
      screenshots.push(filepath);
      log.fileSaved(filename);
      stepNumber++;

      // Try to capture validation state for forms that have submit buttons
      if (step.name === "backup-contact" || step.name === "eligibility-check") {
        try {
          // Click submit to trigger validation errors without filling
          const submitBtn = await page.$(`${step.selector} c-button[type="submit"] button, ${step.selector} button[type="submit"]`);
          if (submitBtn && await submitBtn.isVisible()) {
            await submitBtn.click();
            await page.waitForTimeout(500);
            const validFilename = `register__step-${paddedNum}-${step.name}-validation.png`;
            const validPath = path.join(outputDir, validFilename);
            await page.screenshot({ path: validPath, fullPage: true });
            screenshots.push(validPath);
            log.fileSaved(validFilename);
          }
        } catch {
          // Validation capture is best-effort
        }
      }
    } catch {
      // Step not present in this registration flow, continue
    }
  }

  // ── Step 6: Capture final state (may have redirected) ──
  await page.waitForTimeout(2000);
  const currentUrl = page.url();
  if (currentUrl.includes("/register/complete") || currentUrl.includes("/register/not-ready")) {
    const paddedNum = String(stepNumber).padStart(2, "0");
    const finalFilename = `register__step-${paddedNum}-final-state.png`;
    const finalPath = path.join(outputDir, finalFilename);
    await page.screenshot({ path: finalPath, fullPage: true });
    screenshots.push(finalPath);
    log.fileSaved(finalFilename);
  }

  log.success(`Registration full flow completed (${screenshots.length} images, user consumed: ${email})`);
  return { screenshots, userConsumed: email };
}

async function fillRegistrationForm(
  page: Page,
  data: { firstName: string; lastName: string; email: string; password: string },
): Promise<void> {
  // Fill first name
  const firstNameSelector = '#firstNameInput, input[name="firstName"], c-input-text[name="firstName"] input';
  await page.fill(firstNameSelector, data.firstName).catch(async () => {
    const el = await page.$(firstNameSelector);
    if (el) { await el.click(); await el.type(data.firstName, { delay: 30 }); }
  });
  await page.waitForTimeout(200);

  // Fill last name
  const lastNameSelector = '#lastNameInput, input[name="lastName"], c-input-text[name="lastName"] input';
  await page.fill(lastNameSelector, data.lastName).catch(async () => {
    const el = await page.$(lastNameSelector);
    if (el) { await el.click(); await el.type(data.lastName, { delay: 30 }); }
  });
  await page.waitForTimeout(200);

  // Fill email
  const emailSelector = '#email, input[name="email"], c-input-text[name="email"] input';
  await page.fill(emailSelector, data.email).catch(async () => {
    const el = await page.$(emailSelector);
    if (el) { await el.click(); await el.type(data.email, { delay: 30 }); }
  });
  await page.waitForTimeout(200);

  // Blur email to trigger validation/email-type selector
  await page.keyboard.press("Tab");
  await page.waitForTimeout(500);

  // Fill password
  const passwordSelector = '#password-input, input[name="password"], c-input-text[name="password"] input';
  await page.fill(passwordSelector, data.password).catch(async () => {
    const el = await page.$(passwordSelector);
    if (el) { await el.click(); await el.type(data.password, { delay: 30 }); }
  });
  await page.waitForTimeout(200);
}
