import type { AppConfig } from "../types";
import { interactionGroups, getAllInteractions } from "./interactions";

/**
 * Cariloop Auth application configuration
 */
export const authConfig: AppConfig = {
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
  interactionGroups,
  getAllInteractions,
};

export default authConfig;
