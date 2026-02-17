import type { Interaction, InteractionGroup } from "../types";

/**
 * Auth-specific UI interactions to capture.
 * These cover login, registration, forgot-password, and enrollment screens.
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
        id: "login-filled",
        description: "Fill login form with email and password (no submit)",
        selector: 'form, input[type="email"], input[name="email"]',
        action: "fill",
        fillData: [
          { selector: 'input[type="email"], input[name="email"]', value: "testuser@example.com" },
          { selector: 'input[type="password"], input[name="password"]', value: "SamplePass.123" },
        ],
        settleDelay: 500,
        closeAfter: "none",
        pageFilter: /\/login$/,
      },
      {
        id: "login-validation-empty",
        description: "Submit empty login form to show validation errors",
        selector: 'form, input[type="email"], input[name="email"]',
        action: "fill",
        fillData: [],
        clickAfterFill: 'button[type="submit"]',
        settleDelay: 500,
        closeAfter: "none",
        pageFilter: /\/login$/,
      },
      {
        id: "password-visibility",
        description: "Toggle password visibility",
        selector: "button.password-toggle, [data-testid='password-toggle'], button[type='button']:has(mat-icon)",
        action: "click",
        settleDelay: 200,
        closeAfter: "click",
        pageFilter: /\/login$/,
      },
      {
        id: "forgot-password-link-hover",
        description: "Hover forgot password link on login page",
        selector: "a[href*='forgot'], .forgot-password-link",
        action: "hover",
        settleDelay: 300,
        closeAfter: "none",
        pageFilter: /\/login$/,
      },
    ],
  },

  // ============================================
  // REGISTRATION FORM
  // ============================================
  {
    name: "registration-form",
    description: "Registration form interactions",
    interactions: [
      {
        id: "register-filled",
        description: "Fill registration form with all fields (no submit)",
        selector: "form, .account-creation",
        action: "fill",
        fillData: [
          { selector: '#firstNameInput, input[name="firstName"]', value: "Test" },
          { selector: '#lastNameInput, input[name="lastName"]', value: "User" },
          { selector: '#email, input[name="email"]', value: "test@example.com" },
          { selector: '#password-input, input[name="password"]', value: "Ca.123123" },
        ],
        settleDelay: 800,
        closeAfter: "none",
        pageFilter: /\/register$/,
      },
      {
        id: "register-validation-empty",
        description: "Submit empty registration form to show validation errors",
        selector: "form, .account-creation",
        action: "fill",
        fillData: [],
        clickAfterFill: 'c-button[type="submit"] button, button[type="submit"]',
        settleDelay: 500,
        closeAfter: "none",
        pageFilter: /\/register$/,
      },
      {
        id: "register-email-type-selector",
        description: "Show email type selector by focusing email field",
        selector: "form, .account-creation",
        action: "fill",
        fillData: [
          { selector: '#email, input[name="email"]', value: "test@example.com" },
        ],
        settleDelay: 500,
        closeAfter: "none",
        pageFilter: /\/register$/,
      },
      {
        id: "terms-checkbox-hover",
        description: "Hover over terms checkbox area",
        selector: "mat-checkbox, .checkbox__terms-container",
        action: "hover",
        settleDelay: 300,
        closeAfter: "none",
        pageFilter: /\/register$/,
      },
    ],
  },

  // ============================================
  // FORGOT PASSWORD
  // ============================================
  {
    name: "forgot-password",
    description: "Forgot password form interactions",
    interactions: [
      {
        id: "forgot-password-filled",
        description: "Fill forgot password email field",
        selector: 'form, input[type="email"]',
        action: "fill",
        fillData: [
          { selector: 'input[type="email"], input[name="email"]', value: "testuser@example.com" },
        ],
        settleDelay: 500,
        closeAfter: "none",
        pageFilter: /\/forgot-password$/,
      },
    ],
  },

  // ============================================
  // ENROLLMENT
  // ============================================
  {
    name: "enrollment",
    description: "Enrollment code form interactions",
    interactions: [
      {
        id: "enrollment-code-filled",
        description: "Fill enrollment code field",
        selector: "form, input",
        action: "fill",
        fillData: [
          { selector: 'input[name="enrollmentCode"], input[type="text"], input', value: "TESTCODE123" },
        ],
        settleDelay: 500,
        closeAfter: "none",
        pageFilter: /\/enrollment$/,
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
