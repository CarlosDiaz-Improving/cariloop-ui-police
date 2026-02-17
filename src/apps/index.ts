/**
 * App registry — re-exports from the centralized config system.
 *
 * The app registry is now built dynamically from ui-police.config.ts
 * and interaction modules under src/apps/{name}/interactions.ts.
 */

export * from "./types";
export { APPS, APP_LIST, getAppConfig, getAllApps } from "../core/config";
