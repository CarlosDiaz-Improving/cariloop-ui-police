import type { AppConfig } from "../types";
import { interactionGroups, getAllInteractions } from "./interactions";

/**
 * Cariloop Admin application configuration
 */
export const adminConfig: AppConfig = {
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
  interactionGroups,
  getAllInteractions,
};

export default adminConfig;
