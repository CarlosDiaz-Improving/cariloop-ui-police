export interface EnvConfig {
  name: string;
  baseUrl: string;
}

// App types supported by the tool
export type AppType = "admin" | "plan" | "coach" | "auth";

// Configuration for each app
export interface AppConfig {
  name: string;
  displayName: string;
  pathPrefix: string;
  readySelector: string;
  fallbackPages: string[];
}

const env = Bun.env;

function requireEnv(key: string): string {
  const value = env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function optionalEnv(key: string): string | undefined {
  const value = env[key];
  return value?.trim() || undefined;
}

function requireNumber(key: string): number {
  const value = requireEnv(key);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for environment variable: ${key}`);
  }
  return parsed;
}

// App configurations
export const APPS: Record<AppType, AppConfig> = {
  admin: {
    name: "admin",
    displayName: "Cariloop Admin",
    pathPrefix: "/admin",
    readySelector: 'a[href*="/admin"]',
    fallbackPages: [
      "/admin/dashboard",
      "/admin/users",
      "/admin/companies",
      "/admin/coaches",
      "/admin/reports",
      "/admin/settings",
    ],
  },
  plan: {
    name: "plan",
    displayName: "Cariloop Plan",
    pathPrefix: "/plan",
    readySelector: 'a[href*="/plan"]',
    fallbackPages: [
      "/plan/dashboard",
      "/plan/care-concierge",
      "/plan/resources",
      "/plan/profile",
    ],
  },
  coach: {
    name: "coach",
    displayName: "Cariloop Coach",
    pathPrefix: "/coach",
    readySelector: 'a[href*="/coach"]',
    fallbackPages: [
      "/coach/dashboard",
      "/coach/members",
      "/coach/queue",
      "/coach/schedule",
    ],
  },
  auth: {
    name: "auth",
    displayName: "Cariloop Auth",
    pathPrefix: "",
    readySelector: 'form, input[type="email"]',
    fallbackPages: [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
    ],
  },
};

// Current app state
let currentApp: AppType = "admin";

export function setCurrentApp(app: AppType): void {
  currentApp = app;
}

export function getCurrentApp(): AppType {
  return currentApp;
}

export function getCurrentAppConfig(): AppConfig {
  return APPS[currentApp];
}

export function getScreenshotsDir(): string {
  return `screenshots/cariloop-${currentApp}`;
}

export function getReportsDir(): string {
  return `reports/cariloop-${currentApp}`;
}

// Legacy export for backward compatibility
export const screenshotsDir = "screenshots";
export const reportsDir = "reports";

export const environments: EnvConfig[] = [
  {
    name: "dev",
    baseUrl: requireEnv("DEV_PLAN_URL"),
  },
  {
    name: "local",
    baseUrl: requireEnv("LOCAL_PLAN_URL"),
  },
];

// Credentials - separate per environment with USE_SAME_CREDENTIALS flag
export function getCredentials(envName: string): { email: string; password: string } {
  const useSame = useSameCredentials();
  
  if (useSame) {
    // When using same credentials, use DEV credentials for both
    return {
      email: requireEnv("DEV_CARILOOP_EMAIL"),
      password: requireEnv("DEV_CARILOOP_PASSWORD"),
    };
  }
  
  // Different credentials per environment
  if (envName === "local") {
    return {
      email: requireEnv("LOCAL_CARILOOP_EMAIL"),
      password: requireEnv("LOCAL_CARILOOP_PASSWORD"),
    };
  }
  
  return {
    email: requireEnv("DEV_CARILOOP_EMAIL"),
    password: requireEnv("DEV_CARILOOP_PASSWORD"),
  };
}

// Check if same credentials are used for both environments
export function useSameCredentials(): boolean {
  const value = optionalEnv("USE_SAME_CREDENTIALS");
  return value?.toLowerCase() === "true";
}

// Legacy export for backward compatibility
export const credentials = {
  email: optionalEnv("DEV_CARILOOP_EMAIL") ?? "",
  password: optionalEnv("DEV_CARILOOP_PASSWORD") ?? "",
};

export const viewport = { width: 1920, height: 1080 };

// Fallback pages (now dynamic based on current app)
export function getFallbackPages(): string[] {
  return APPS[currentApp].fallbackPages;
}

// Legacy export for backward compatibility
export const fallbackAdminPages = APPS.admin.fallbackPages;

export const timeouts = {
  loginNavigation: requireNumber("LOGIN_NAV_TIMEOUT"),
  loginRedirect: requireNumber("LOGIN_REDIRECT_TIMEOUT"),
  loginFormReady: requireNumber("LOGIN_FORM_TIMEOUT"),
  pageNavigation: requireNumber("PAGE_NAV_TIMEOUT"),
  contentReady: requireNumber("CONTENT_READY_TIMEOUT"),
  settleDelay: requireNumber("SETTLE_DELAY"),
};

export const retries = {
  login: requireNumber("LOGIN_RETRIES"), // 1 retry = 2 total attempts
};
