/**
 * Core configuration module
 *
 * Reads non-sensitive settings from ui-police.config.ts (project root).
 * Only credentials are read from .env via environment variables.
 */

import projectConfig from "../../ui-police.config";
import { requireEnv } from "../utils/env";
import type {
  AppConfig,
  AppDefinition,
  EnvironmentDefinition,
  ViewportPreset,
  ViewportCustom,
} from "../types/config";

// ============================================
// PROJECT CONFIG (re-export for convenience)
// ============================================

export { projectConfig };

// ============================================
// VIEWPORT CONFIGURATION
// ============================================

/**
 * Viewport presets for common screen sizes
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
 * Get viewport dimensions from the central config
 */
export function getViewport(): { width: number; height: number } {
  const vp = projectConfig.capture.viewport;

  // Custom dimensions
  if ("width" in vp && "height" in vp) {
    return { width: (vp as ViewportCustom).width, height: (vp as ViewportCustom).height };
  }

  // Preset
  const presetName = (vp as ViewportPreset).preset ?? "desktop-hd";
  return VIEWPORT_PRESETS[presetName] ?? VIEWPORT_PRESETS["desktop-hd"]!;
}

/**
 * Get viewport as a display string (e.g., "1920x1080")
 */
export function getViewportString(): string {
  const { width, height } = getViewport();
  return `${width}x${height}`;
}

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================

export type EnvConfig = EnvironmentDefinition;

export const environments: EnvConfig[] = projectConfig.environments;

// ============================================
// CREDENTIALS
// ============================================

/**
 * Check if same credentials are used for all environments
 */
export function useSameCredentials(): boolean {
  return projectConfig.useSameCredentials;
}

/**
 * Get credentials for a specific environment.
 *
 * Reads from .env using the pattern:
 *   {ENV_NAME_UPPER}_EMAIL / {ENV_NAME_UPPER}_PASSWORD
 *
 * When useSameCredentials is true, always uses the first environment's credentials.
 */
export function getCredentials(envName: string): { email: string; password: string } {
  const targetEnv = useSameCredentials()
    ? environments[0]!.name
    : envName;

  const prefix = targetEnv.toUpperCase();
  return {
    email: requireEnv(`${prefix}_EMAIL`),
    password: requireEnv(`${prefix}_PASSWORD`),
  };
}

// ============================================
// TIMEOUTS & CAPTURE OPTIONS
// ============================================

export const timeouts = {
  loginNavigation: projectConfig.timeouts.loginNavigation,
  loginRedirect: projectConfig.timeouts.loginRedirect,
  loginFormReady: projectConfig.timeouts.loginFormReady,
  pageNavigation: projectConfig.timeouts.pageNavigation,
  contentReady: projectConfig.timeouts.contentReady,
  settleDelay: projectConfig.capture.settleDelay,
};

export const retries = {
  login: projectConfig.loginRetries,
};

export const captureOptions = projectConfig.capture;

// ============================================
// APP REGISTRY (built dynamically from config + interaction modules)
// ============================================

/** Map of app name → loaded AppConfig */
const _appRegistry = new Map<string, AppConfig>();

/** Ordered list of app names (display order from config) */
export const APP_LIST: string[] = projectConfig.apps.map((a) => a.name);

/**
 * Load interactions for an app, if an interactions module exists.
 * Returns empty arrays if no interactions module is found.
 */
function loadInteractions(appName: string): {
  interactionGroups: AppConfig["interactionGroups"];
  getAllInteractions: AppConfig["getAllInteractions"];
} {
  try {
    // Dynamic require — each app may or may not have an interactions module
    const mod = require(`../apps/${appName}/interactions`);
    return {
      interactionGroups: mod.interactionGroups ?? [],
      getAllInteractions: mod.getAllInteractions ?? (() => []),
    };
  } catch {
    return {
      interactionGroups: [],
      getAllInteractions: () => [],
    };
  }
}

/**
 * Build the full runtime AppConfig from an AppDefinition + interactions
 */
function buildAppConfig(def: AppDefinition): AppConfig {
  const interactions = loadInteractions(def.name);
  return {
    name: def.name,
    displayName: def.displayName,
    pathPrefix: def.pathPrefix,
    readySelector: def.readySelector,
    requiresAuth: def.requiresAuth,
    fallbackPages: def.fallbackPages,
    options: def.options ?? {},
    interactionGroups: interactions.interactionGroups,
    getAllInteractions: interactions.getAllInteractions,
  };
}

// Initialize the registry
for (const def of projectConfig.apps) {
  _appRegistry.set(def.name, buildAppConfig(def));
}

/**
 * Record-style accessor for all apps (keyed by name)
 */
export const APPS: Record<string, AppConfig> = Object.fromEntries(_appRegistry);

/**
 * Get app config by name
 */
export function getAppConfig(appName: string): AppConfig {
  const config = _appRegistry.get(appName);
  if (!config) {
    throw new Error(`Unknown app: "${appName}". Available: ${APP_LIST.join(", ")}`);
  }
  return config;
}

/**
 * Get all app configs in display order
 */
export function getAllApps(): AppConfig[] {
  return APP_LIST.map((name) => _appRegistry.get(name)!);
}

// ============================================
// CURRENT APP STATE
// ============================================

let currentApp: string = APP_LIST[0] ?? "admin";

export function setCurrentApp(app: string): void {
  if (!_appRegistry.has(app)) {
    throw new Error(`Unknown app: "${app}". Available: ${APP_LIST.join(", ")}`);
  }
  currentApp = app;
}

export function getCurrentApp(): string {
  return currentApp;
}

export function getCurrentAppConfig(): AppConfig {
  return _appRegistry.get(currentApp)!;
}

// ============================================
// OUTPUT DIRECTORIES
// ============================================

export function getOutputDir(): string {
  return "output";
}

export function getReportsDir(): string {
  return `output/reports/cariloop-${currentApp}`;
}

// ============================================
// HELPERS
// ============================================

export function getFallbackPages(): string[] {
  return getCurrentAppConfig().fallbackPages;
}

// Re-export types
export type { AppConfig, EnvConfig as EnvironmentConfig };
