import type { AppConfig } from "../types";
import { interactionGroups, getAllInteractions } from "./interactions";

/**
 * Cariloop Coach application configuration
 */
export const coachConfig: AppConfig = {
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
  interactionGroups,
  getAllInteractions,
};

export default coachConfig;
