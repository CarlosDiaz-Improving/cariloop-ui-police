import type { AppConfig } from "../types";
import { interactionGroups, getAllInteractions } from "./interactions";

/**
 * Cariloop Auth application configuration
 * 
 * Most auth pages are public (no login needed). The skipLogin flag
 * tells the capture pipeline to navigate directly without authenticating.
 */
export const authConfig: AppConfig = {
  name: "auth",
  displayName: "Cariloop Auth",
  pathPrefix: "",
  readySelector: 'form, input[type="email"], .container, app-root',
  skipLogin: true,
  fallbackPages: [
    "/login",
    "/register",
    "/forgot-password",
    "/disconnection",
    "/loading-state",
    "/enrollment",
    "/enrollment/raymondjames",
    "/enrollment/test-mariner",
    "/expired-link",
    "/register/sso-error",
    "/pgp",
    "/masthead",
    "/choose-adventure",
    "/gift-redemption",
    "/event?response=accepted",
    "/event?response=declined",
    "/event?response=expired",
    "/nonexistent-page-404-test",
  ],
  interactionGroups,
  getAllInteractions,
};

export default authConfig;
