/**
 * App registry - exports all app configurations
 */

import type { AppConfig, AppType } from "./types";
import { adminConfig } from "./admin";
import { planConfig } from "./plan";
import { coachConfig } from "./coach";
import { authConfig } from "./auth";

export * from "./types";

/**
 * All available app configurations
 */
export const APPS: Record<AppType, AppConfig> = {
  admin: adminConfig,
  plan: planConfig,
  coach: coachConfig,
  auth: authConfig,
};

/**
 * List of all app types in display order
 */
export const APP_LIST: AppType[] = ["admin", "plan", "coach", "auth"];

/**
 * Get app config by name
 */
export function getAppConfig(appType: AppType): AppConfig {
  return APPS[appType];
}

/**
 * Get all app configs
 */
export function getAllApps(): AppConfig[] {
  return APP_LIST.map((type) => APPS[type]);
}
