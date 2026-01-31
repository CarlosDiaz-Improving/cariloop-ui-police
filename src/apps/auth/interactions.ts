import type { Interaction, InteractionGroup } from "../types";

/**
 * Auth-specific UI interactions to capture.
 * These are for login, registration, and password reset screens.
 */
export const interactionGroups: InteractionGroup[] = [
  // ============================================
  // LOGIN FORM
  // ============================================
  {
    name: "login-form",
    description: "Login form interactions",
    interactions: [
      {
        id: "password-visibility",
        description: "Toggle password visibility",
        selector: "button.password-toggle, [data-testid='password-toggle'], button[type='button']:has(mat-icon)",
        action: "click",
        settleDelay: 200,
        closeAfter: "click",
        pageFilter: /\/login$/,
      },
    ],
  },

  // ============================================
  // FORGOT PASSWORD
  // ============================================
  {
    name: "forgot-password",
    description: "Forgot password flow interactions",
    interactions: [
      {
        id: "forgot-password-link",
        description: "Click forgot password link (don't submit)",
        selector: "a[href*='forgot'], .forgot-password-link",
        action: "hover",
        settleDelay: 300,
        closeAfter: "none",
        pageFilter: /\/login$/,
      },
    ],
  },

  // ============================================
  // REGISTRATION
  // ============================================
  {
    name: "registration",
    description: "Registration form interactions",
    interactions: [
      {
        id: "terms-checkbox",
        description: "Hover over terms checkbox to show tooltip",
        selector: "mat-checkbox.terms, [data-testid='terms-checkbox']",
        action: "hover",
        settleDelay: 300,
        closeAfter: "none",
        pageFilter: /\/register$/,
      },
    ],
  },
];

/**
 * Get all auth interactions flattened
 */
export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
