import type { Page } from "playwright";
import type { Interaction, InteractionGroup } from "../types";

/**
 * Admin-specific UI interactions to capture.
 * These are Angular Material components specific to the Cariloop Admin interface.
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
        selector: "table mat-cell button.mat-icon-button, mat-cell button[mat-icon-button]",
        action: "click",
        waitForSelector: ".mat-menu-panel, .mat-mdc-menu-panel",
        settleDelay: 400,
        closeAfter: "escape",
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
        selector: '.menu-container .menu-item:has(mat-icon:text("keyboard_arrow_down"))',
        action: "click",
        waitForSelector: ".menu-container app-side-item app-side-item",
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
        selector: ".header-actions button.outline-btn-blue",
        action: "click",
        waitForSelector: "mat-dialog-container, .mat-dialog-container, .mat-mdc-dialog-container",
        settleDelay: 500,
        closeAfter: "escape",
        pageFilter: /\/users$/,
      },
      {
        id: "add-type-button",
        description: "Click ADD button on Post Types page",
        selector: ".header-actions button.outline-btn-blue",
        action: "click",
        waitForSelector: "mat-dialog-container, .mat-dialog-container",
        settleDelay: 500,
        closeAfter: "escape",
        pageFilter: /\/types$/,
      },
      {
        id: "add-provisioning-button",
        description: "Click Add New Provisioning button",
        selector: "button.add-button",
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
        selector: "span.lang-selector",
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
        selector: ".main-needs .need:first-child",
        action: "click",
        waitForSelector: ".selected-need",
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
        selector: ".container-testimonial:first-child",
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
        selector: "table mat-row:first-child button[mat-icon-button]",
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
 * Get all admin interactions flattened
 */
export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
