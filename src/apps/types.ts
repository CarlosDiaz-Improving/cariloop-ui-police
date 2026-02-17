/**
 * Shared types for app configurations and interactions
 */

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
  action: "click" | "hover" | "fill";
  /** Data for fill actions: array of {selector, value} pairs to fill before screenshot */
  fillData?: Array<{ selector: string; value: string }>;
  /** Optional: Wait for this selector to appear after the interaction */
  waitForSelector?: string;
  /** Optional: Additional delay after interaction (ms) */
  settleDelay?: number;
  /** Optional: Only run on pages matching this regex */
  pageFilter?: RegExp;
  /** Optional: Close/reset after capture (click same element or press Escape) */
  closeAfter?: "click" | "escape" | "none";
  /** Optional: click a submit button after filling (for validation-error captures) */
  clickAfterFill?: string;
}

/**
 * Defines a group of related interactions
 */
export interface InteractionGroup {
  name: string;
  description: string;
  interactions: Interaction[];
}

/**
 * Application configuration
 */
export interface AppConfig {
  /** Internal name (admin, plan, coach, auth) */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** URL path prefix (e.g., "/admin", "/plan", "" for root) */
  pathPrefix: string;
  /** Selector to wait for after login to confirm app is ready */
  readySelector: string;
  /** Default pages to capture if discovery fails */
  fallbackPages: string[];
  /** Interaction groups for this app */
  interactionGroups: InteractionGroup[];
  /** Function to get all interactions flattened */
  getAllInteractions: () => Interaction[];
  /** If true, skip login before capturing pages (e.g., auth app has public pages) */
  skipLogin?: boolean;
}

/**
 * App type literal
 */
export type AppType = "admin" | "plan" | "coach" | "auth";
