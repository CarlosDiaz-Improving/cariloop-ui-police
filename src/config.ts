export interface EnvConfig {
  name: string;
  baseUrl: string;
}

const env = Bun.env;

function requireEnv(key: string): string {
  const value = env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function requireNumber(key: string): number {
  const value = requireEnv(key);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for environment variable: ${key}`);
  }
  return parsed;
}

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

export const credentials = {
  email: requireEnv("CARILOOP_EMAIL"),
  password: requireEnv("CARILOOP_PASSWORD"),
};

export const viewport = { width: 1920, height: 1080 };

export const screenshotsDir = "screenshots";
export const reportsDir = "reports";

// Fallback admin pages if automatic discovery fails
export const fallbackAdminPages = [
  "/admin/dashboard",
  "/admin/users",
  "/admin/companies",
  "/admin/coaches",
  "/admin/reports",
  "/admin/settings",
];

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
