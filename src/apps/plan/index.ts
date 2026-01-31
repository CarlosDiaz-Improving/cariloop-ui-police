import type { AppConfig } from "../types";
import { interactionGroups, getAllInteractions } from "./interactions";

/**
 * Cariloop Plan application configuration
 */
export const planConfig: AppConfig = {
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
  interactionGroups,
  getAllInteractions,
};

export default planConfig;
