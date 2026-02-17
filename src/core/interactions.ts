import type { Page } from "playwright";
import type { Interaction } from "../apps/types";
import { timeouts, getCurrentAppConfig } from "./config";

/**
 * Close any open overlays, modals, menus, dialogs before attempting new interactions
 */
export async function closeAllOverlays(page: Page): Promise<void> {
  // Press Escape multiple times to close any open overlays
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  
  // Click on backdrop if it exists to close overlays
  try {
    const backdrop = await page.$(".cdk-overlay-backdrop");
    if (backdrop) {
      await backdrop.click({ force: true });
      await page.waitForTimeout(200);
    }
  } catch {
    // Ignore errors
  }
  
  // Wait for overlays to be gone
  try {
    await page.waitForSelector(".cdk-overlay-backdrop", { state: "hidden", timeout: 1000 });
  } catch {
    // Might not exist, that's fine
  }
}

/**
 * Execute a single interaction and capture the resulting state
 */
export async function executeInteraction(
  page: Page,
  interaction: Interaction,
  pagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, close any open overlays from previous interactions
    await closeAllOverlays(page);
    
    // Wait a moment for page to stabilize
    await page.waitForTimeout(200);
    
    // Check if element exists with a short timeout
    const element = await page.$(interaction.selector);
    if (!element) {
      return { success: false, error: `Element not found: ${interaction.selector}` };
    }

    // Check if element is visible
    const isVisible = await element.isVisible();
    if (!isVisible) {
      return { success: false, error: `Element not visible: ${interaction.selector}` };
    }

    // Scroll element into view with shorter timeout
    try {
      await element.scrollIntoViewIfNeeded({ timeout: 5000 });
    } catch {
      return { success: false, error: `Could not scroll to element` };
    }

    // Perform the action with force option to bypass intercepted clicks
    if (interaction.action === "click") {
      await element.click({ timeout: 5000 });
    } else if (interaction.action === "hover") {
      await element.hover({ timeout: 5000 });
    } else if (interaction.action === "fill" && interaction.fillData) {
      // Fill form fields sequentially
      for (const { selector, value } of interaction.fillData) {
        try {
          await page.fill(selector, value);
          await page.waitForTimeout(100);
        } catch (fillErr) {
          // Try click + type as fallback for non-standard inputs
          try {
            const input = await page.$(selector);
            if (input) {
              await input.click();
              await input.type(value, { delay: 20 });
            }
          } catch {
            // Skip this field if it can't be filled
          }
        }
      }
      // Optionally click a button after filling (e.g., submit for validation errors)
      if (interaction.clickAfterFill) {
        try {
          await page.click(interaction.clickAfterFill, { timeout: 3000 });
        } catch {
          // Button might not exist or be disabled
        }
      }
    }

    // Wait for expected result
    if (interaction.waitForSelector) {
      try {
        await page.waitForSelector(interaction.waitForSelector, {
          timeout: 3000,
        });
      } catch {
        // Element might not appear, but we still capture
      }
    }

    // Additional settle time
    const delay = interaction.settleDelay ?? timeouts.settleDelay;
    await page.waitForTimeout(delay);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Close/reset the interaction state
 */
export async function closeInteraction(
  page: Page,
  interaction: Interaction
): Promise<void> {
  if (interaction.closeAfter === "escape") {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    // Double escape to make sure overlays are closed
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  } else if (interaction.closeAfter === "click") {
    const element = await page.$(interaction.selector);
    if (element) {
      await element.click();
      await page.waitForTimeout(200);
    }
  }
  
  // Always try to close any remaining overlays
  await closeAllOverlays(page);
}

/**
 * Check if an interaction should run on a given page
 */
export function shouldRunOnPage(interaction: Interaction, pagePath: string): boolean {
  if (!interaction.pageFilter) return true;
  return interaction.pageFilter.test(pagePath);
}

/**
 * Get all interactions for the current app
 */
export function getAllInteractions(): Interaction[] {
  const appConfig = getCurrentAppConfig();
  return appConfig.getAllInteractions();
}
