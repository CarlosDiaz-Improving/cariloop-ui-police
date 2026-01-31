/**
 * Core configuration module
 * 
 * This module provides shared configuration for environments, credentials,
 * viewport settings, and timeouts. App-specific configurations are in src/apps/.
 */

import { requireEnv, optionalEnv, requireNumber, optionalNumber, optionalBoolean } from "../utils/env";
import { APPS, APP_LIST, type AppType, type AppConfig } from "../apps";

// ============================================
// VIEWPORT CONFIGURATION
// ============================================

/**
 * Viewport presets for common screen sizes
 * 
 * Recommended resolutions:
 * - desktop-hd:   1920x1080 (Full HD, most common desktop)
 * - desktop:      1440x900  (MacBook Pro 15", common laptop)
 * - laptop:       1366x768  (Most common laptop resolution)
 * - tablet:       1024x768  (iPad landscape)
 * - tablet-port:  768x1024  (iPad portrait)
 * - mobile:       375x812   (iPhone X/11/12/13)
 * - mobile-small: 320x568   (iPhone SE)
 */
export const VIEWPORT_PRESETS: Record<string, { width: number; height: number }> = {
  "desktop-hd": { width: 1920, height: 1080 },
  "desktop": { width: 1440, height: 900 },
  "laptop": { width: 1366, height: 768 },
  "tablet": { width: 1024, height: 768 },
  "tablet-port": { width: 768, height: 1024 },
  "mobile": { width: 375, height: 812 },
  "mobile-small": { width: 320, height: 568 },
};

/**
 * Get viewport dimensions from environment or preset
 * 
 * Environment variables:
 * - VIEWPORT_PRESET: Use a named preset (desktop-hd, desktop, laptop, tablet, mobile)
 * - VIEWPORT_WIDTH: Custom width (overrides preset)
 * - VIEWPORT_HEIGHT: Custom height (overrides preset)
 * 
 * Default: desktop-hd (1920x1080)
 */
export function getViewport(): { width: number; height: number } {
  const presetName = optionalEnv("VIEWPORT_PRESET") ?? "desktop-hd";
  const preset = VIEWPORT_PRESETS[presetName] ?? VIEWPORT_PRESETS["desktop-hd"]!;
  
  return {
    width: optionalNumber("VIEWPORT_WIDTH", preset.width),
    height: optionalNumber("VIEWPORT_HEIGHT", preset.height),
  };
}

// Legacy export for backward compatibility
export const viewport = getViewport();

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================

export interface EnvConfig {
  name: string;
  baseUrl: string;
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

// ============================================
// CREDENTIALS
// ============================================

/**
 * Check if same credentials are used for both environments
 */
export function useSameCredentials(): boolean {
  return optionalBoolean("USE_SAME_CREDENTIALS", false);
}

/**
 * Get credentials for a specific environment
 * 
 * When USE_SAME_CREDENTIALS=true, uses DEV credentials for both environments
 * When USE_SAME_CREDENTIALS=false, uses environment-specific credentials
 */
export function getCredentials(envName: string): { email: string; password: string } {
  if (useSameCredentials()) {
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

// ============================================
// TIMEOUTS
// ============================================

export const timeouts = {
  loginNavigation: requireNumber("LOGIN_NAV_TIMEOUT"),
  loginRedirect: requireNumber("LOGIN_REDIRECT_TIMEOUT"),
  loginFormReady: requireNumber("LOGIN_FORM_TIMEOUT"),
  pageNavigation: requireNumber("PAGE_NAV_TIMEOUT"),
  contentReady: requireNumber("CONTENT_READY_TIMEOUT"),
  settleDelay: requireNumber("SETTLE_DELAY"),
};

export const retries = {
  login: requireNumber("LOGIN_RETRIES"),
};

// ============================================
// CURRENT APP STATE
// ============================================

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

// ============================================
// OUTPUT DIRECTORIES
// ============================================

export function getScreenshotsDir(): string {
  return `screenshots/cariloop-${currentApp}`;
}

export function getReportsDir(): string {
  return `reports/cariloop-${currentApp}`;
}

// ============================================
// HELPERS
// ============================================

export function getFallbackPages(): string[] {
  return APPS[currentApp].fallbackPages;
}

// Re-export app-related items
export { APPS, APP_LIST, type AppType, type AppConfig };
