import type { Page } from "playwright";
import { timeouts } from "./config";

/**
 * Defines an interaction to perform on a page and capture the resulting UI state.
 */
export interface Interaction {
  /** Unique identifier for this interaction (used in screenshot filenames) */
  id: string;
  /** Human-readable description */
  description: string;
  /** CSS selector for the element to interact with */
  selector: string;
  /** Type of interaction */
  action: "click" | "hover";
  /** Optional: Wait for this selector to appear after the interaction */
  waitForSelector?: string;
  /** Optional: Additional delay after interaction (ms) */
  settleDelay?: number;
  /** Optional: Only run on pages matching this regex */
  pageFilter?: RegExp;
  /** Optional: Close/reset after capture (click same element or press Escape) */
  closeAfter?: "click" | "escape" | "none";
}

/**
 * Defines a group of related interactions (e.g., all menu interactions)
 */
export interface InteractionGroup {
  name: string;
  description: string;
  interactions: Interaction[];
}

/**
 * Result of executing an interaction
 */
export interface InteractionResult {
  interactionId: string;
  pagePath: string;
  success: boolean;
  screenshotPath?: string;
  error?: string;
}

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
 * Configuration for all UI interactions to capture.
 * Based on actual Cariloop Admin Angular Material UI components.
 */
export const interactionGroups: InteractionGroup[] = [
  // ============================================
  // ROW ACTION MENUS (3-dot menus using mat-menu)
  // ============================================
  {
    name: "row-action-menus",
    description: "Three-dot menus on table rows that show actions (Edit, Delete, Provisioning, etc.)",
    interactions: [
      {
        id: "row-menu-first",
        description: "Click first row's 3-dot menu button to reveal actions",
        // Angular Material: button with mat-icon-button containing more_vert icon
        selector: 'table mat-cell button.mat-icon-button, mat-cell button[mat-icon-button]',
        action: "click",
        // mat-menu renders as overlay with class .mat-menu-panel
        waitForSelector: ".mat-menu-panel, .mat-mdc-menu-panel",
        settleDelay: 400,
        closeAfter: "escape",
        // Only on pages with tables that have action menus
        pageFilter: /\/(organizations|users)$/,
      },
    ],
  },

  // ============================================
  // SIDEBAR EXPANDABLE SECTIONS
  // ============================================
  {
    name: "sidebar-sections",
    description: "Expandable sidebar menu sections (SERVICES, CONTENT)",
    interactions: [
      {
        id: "sidebar-services",
        description: "Expand SERVICES section in sidebar to show sub-items",
        // Look for the SERVICES menu item that has an expand arrow
        selector: '.menu-container .menu-item:has(mat-icon:text("keyboard_arrow_down"))',
        action: "click",
        // Wait for children to appear
        waitForSelector: '.menu-container app-side-item app-side-item',
        settleDelay: 400,
        closeAfter: "none",
      },
    ],
  },

  // ============================================
  // ADD/CREATE BUTTONS (open dialogs/modals)
  // ============================================
  {
    name: "add-buttons",
    description: "ADD buttons that open Angular Material dialogs",
    interactions: [
      {
        id: "add-user-button",
        description: "Click ADD button to open user creation dialog",
        selector: '.header-actions button.outline-btn-blue',
        action: "click",
        // mat-dialog renders with mat-dialog-container
        waitForSelector: "mat-dialog-container, .mat-dialog-container, .mat-mdc-dialog-container",
        settleDelay: 500,
        closeAfter: "escape",
        pageFilter: /\/users$/,
      },
      {
        id: "add-type-button",
        description: "Click ADD button on Post Types page",
        selector: '.header-actions button.outline-btn-blue',
        action: "click",
        waitForSelector: "mat-dialog-container, .mat-dialog-container",
        settleDelay: 500,
        closeAfter: "escape",
        pageFilter: /\/types$/,
      },
      {
        id: "add-provisioning-button",
        description: "Click Add New Provisioning button",
        selector: 'button.add-button',
        action: "click",
        waitForSelector: "mat-dialog-container, .mat-dialog-container",
        settleDelay: 500,
        closeAfter: "escape",
        pageFilter: /\/provisioning$/,
      },
    ],
  },

  // ============================================
  // LANGUAGE SELECTOR MENUS
  // ============================================
  {
    name: "language-menus",
    description: "Language selector dropdowns in content pages",
    interactions: [
      {
        id: "lang-selector",
        description: "Click language selector to show language options",
        selector: 'span.lang-selector',
        action: "click",
        waitForSelector: ".mat-menu-panel, .mat-mdc-menu-panel",
        settleDelay: 400,
        closeAfter: "escape",
        pageFilter: /\/needs$/,
      },
    ],
  },

  // ============================================
  // NEEDS CATEGORY SELECTION
  // ============================================
  {
    name: "needs-categories",
    description: "Click on need categories to expand children",
    interactions: [
      {
        id: "need-category-select",
        description: "Click on first need category to show subcategories",
        selector: '.main-needs .need:first-child',
        action: "click",
        waitForSelector: '.selected-need',
        settleDelay: 400,
        closeAfter: "none",
        pageFilter: /\/needs$/,
      },
    ],
  },

  // ============================================
  // TESTIMONIALS HOVER
  // ============================================
  {
    name: "testimonial-actions",
    description: "Hover on testimonial cards",
    interactions: [
      {
        id: "testimonial-hover",
        description: "Hover on testimonial card to highlight actions",
        selector: '.container-testimonial:first-child',
        action: "hover",
        settleDelay: 300,
        closeAfter: "none",
        pageFilter: /\/testimonials$/,
      },
    ],
  },

  // ============================================
  // ORGANIZATION ROW MENU
  // ============================================
  {
    name: "org-row-menu",
    description: "Organization table row action menu",
    interactions: [
      {
        id: "org-menu-first",
        description: "Click first organization's action menu",
        selector: 'table mat-row:first-child button[mat-icon-button]',
        action: "click",
        waitForSelector: ".mat-menu-panel",
        settleDelay: 400,
        closeAfter: "escape",
        pageFilter: /\/organizations$/,
      },
    ],
  },
];

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
 * Get all interactions flattened from groups
 */
export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}

/**
 * Get interactions for a specific group
 */
export function getInteractionsByGroup(groupName: string): Interaction[] {
  const group = interactionGroups.find((g) => g.name === groupName);
  return group?.interactions ?? [];
}
