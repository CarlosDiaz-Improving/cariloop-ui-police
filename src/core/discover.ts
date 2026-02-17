import type { Page } from "playwright";
import { getCurrentAppConfig, getFallbackPages } from "./config";
import { log, style } from "../utils/terminal";

export async function discoverPages(page: Page): Promise<string[]> {
  const appConfig = getCurrentAppConfig();
  const pathPrefix = appConfig.pathPrefix;
  
  log.action(`Scanning sidebar/nav for ${style.highlight(appConfig.displayName)} links...`);

  const links = await page.evaluate((prefix: string) => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    return anchors
      .map((a) => {
        try {
          const url = new URL(a.href, window.location.origin);
          return url.pathname;
        } catch {
          return null;
        }
      })
      .filter((path): path is string => {
        if (path === null) return false;
        // For auth app (no prefix), capture all known auth route prefixes
        if (prefix === "") {
          const authPrefixes = [
            "/login", "/register", "/forgot", "/reset",
            "/enrollment", "/disconnection", "/loading-state",
            "/expired-link", "/expired-invite", "/choose-adventure",
            "/new-password", "/confirm", "/case", "/logout",
            "/pgp", "/masthead", "/mobile", "/gift-redemption",
            "/webinar", "/share", "/verify-care", "/sign-callback",
            "/urbansitter-coach-sso", "/event",
          ];
          return path === "/" || authPrefixes.some((p) => path.startsWith(p));
        }
        return path.startsWith(prefix);
      });
  }, pathPrefix);

  // Deduplicate and remove fragments/query params (already handled by URL parsing)
  const unique = [...new Set(links)].sort();

  // For apps that don't require auth (e.g., auth app), most pages aren't linked
  // from a single page. Always merge discovered links with the full fallback list
  // so every configured page gets captured.
  if (!appConfig.requiresAuth) {
    const fallback = getFallbackPages();
    const merged = [...new Set([...unique, ...fallback])].sort();
    log.success(`Discovered ${unique.length} links, merged with ${fallback.length} fallback pages → ${merged.length} total`);
    log.tree(merged);
    console.log("");
    return merged;
  }

  if (unique.length === 0) {
    log.warning(`No links found, using fallback list`);
    const fallback = getFallbackPages();
    log.tree(fallback);
    console.log("");
    return fallback;
  }

  log.success(`Discovered ${unique.length} pages`);
  log.tree(unique);
  console.log("");
  
  return unique;
}
