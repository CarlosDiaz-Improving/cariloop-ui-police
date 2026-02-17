/**
 * UI Police — Central Configuration
 *
 * All non-sensitive settings live here. Sensitive data (credentials)
 * stays in .env. See .env.example for the required secret variables.
 */

import type { ProjectConfig } from "./src/types/config";

const config: ProjectConfig = {
  version: "1.0.0",

  // ── Environments ────────────────────────────────────────────────
  // Order matters: the capture pipeline runs them sequentially.
  // The comparison step pairs the two most recent runs for the
  // selected app (one per environment).
  environments: [
    { name: "develop", baseUrl: "https://dev-plan.cariloop.com" },
    { name: "local", baseUrl: "https://local-plan.cariloop.com" },
    // { name: "staging", baseUrl: "https://staging-plan.cariloop.com" },
  ],

  // ── Capture Options ─────────────────────────────────────────────
  capture: {
    viewport: { preset: "desktop-hd" },
    // viewport: { width: 1920, height: 1080 },  // custom dimensions
    fullPage: true,
    format: "png",
    settleDelay: 2000,
    headless: true,
  },

  // ── Timeouts (ms) ───────────────────────────────────────────────
  timeouts: {
    loginNavigation: 45000,
    loginRedirect: 45000,
    loginFormReady: 20000,
    pageNavigation: 30000,
    contentReady: 15000,
  },

  // ── Authentication ──────────────────────────────────────────────
  loginRetries: 1,
  useSameCredentials: false,

  // ── Applications ────────────────────────────────────────────────
  apps: [
    {
      name: "admin",
      displayName: "Cariloop Admin",
      pathPrefix: "/admin",
      readySelector: 'a[href*="/admin"]',
      requiresAuth: true,
      fallbackPages: [
        "/admin/dashboard",
        "/admin/users",
        "/admin/companies",
        "/admin/coaches",
        "/admin/reports",
        "/admin/settings",
      ],
    },
    {
      name: "auth",
      displayName: "Cariloop Auth",
      pathPrefix: "",
      readySelector: 'form, input[type="email"], .container, app-root',
      requiresAuth: false,
      fallbackPages: [
        "/login",
        "/register",
        "/forgot-password",
        "/disconnection",
        "/loading-state",
        "/enrollment",
        "/enrollment/raymondjames",
        "/enrollment/test-mariner",
        "/expired-link",
        "/register/sso-error",
        "/pgp",
        "/masthead",
        "/choose-adventure",
        "/gift-redemption",
        "/event?response=accepted",
        "/event?response=declined",
        "/event?response=expired",
        "/nonexistent-page-404-test",
      ],
      options: {
        registrationMode: "screenshot-only",
      },
    },
    {
      name: "coach",
      displayName: "Cariloop Coach",
      pathPrefix: "/coach",
      readySelector: 'a[href*="/coach"]',
      requiresAuth: true,
      fallbackPages: [
        "/coach/dashboard",
        "/coach/members",
        "/coach/queue",
        "/coach/schedule",
      ],
    },
    {
      name: "employer",
      displayName: "Cariloop Employer",
      pathPrefix: "/employer",
      readySelector: 'a[href*="/employer"]',
      requiresAuth: true,
      fallbackPages: [],
    },
    {
      name: "engagement",
      displayName: "Cariloop Engagement",
      pathPrefix: "/engagement",
      readySelector: 'a[href*="/engagement"]',
      requiresAuth: true,
      fallbackPages: [],
    },
    {
      name: "enterprise",
      displayName: "Cariloop Enterprise",
      pathPrefix: "/enterprise",
      readySelector: 'a[href*="/enterprise"]',
      requiresAuth: true,
      fallbackPages: [],
    },
    {
      name: "facilitator",
      displayName: "Cariloop Facilitator",
      pathPrefix: "/facilitator",
      readySelector: 'a[href*="/facilitator"]',
      requiresAuth: true,
      fallbackPages: [],
    },
    {
      name: "plan",
      displayName: "Cariloop Plan",
      pathPrefix: "/plan",
      readySelector: 'a[href*="/plan"]',
      requiresAuth: true,
      fallbackPages: [
        "/plan/dashboard",
        "/plan/care-concierge",
        "/plan/resources",
        "/plan/profile",
      ],
    },
    {
      name: "provider",
      displayName: "Cariloop Provider",
      pathPrefix: "/provider",
      readySelector: 'a[href*="/provider"]',
      requiresAuth: true,
      fallbackPages: [],
    },
    {
      name: "search",
      displayName: "Cariloop Search",
      pathPrefix: "/search",
      readySelector: 'a[href*="/search"]',
      requiresAuth: true,
      fallbackPages: [],
    },
  ],
};

export default config;
