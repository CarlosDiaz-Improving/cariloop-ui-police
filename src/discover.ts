import type { Page } from "playwright";
import { getCurrentAppConfig, getFallbackPages } from "./config";

export async function discoverPages(page: Page): Promise<string[]> {
  const appConfig = getCurrentAppConfig();
  const pathPrefix = appConfig.pathPrefix;
  
  console.log(`  Scanning sidebar/nav for ${appConfig.displayName} links...`);

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
        // For auth app (no prefix), only capture root-level auth pages
        if (prefix === "") {
          return path === "/" || path.startsWith("/login") || path.startsWith("/register") || 
                 path.startsWith("/forgot") || path.startsWith("/reset");
        }
        return path.startsWith(prefix);
      });
  }, pathPrefix);

  // Deduplicate and remove fragments/query params (already handled by URL parsing)
  const unique = [...new Set(links)].sort();

  if (unique.length === 0) {
    console.log(`  No ${appConfig.displayName} links found, using fallback list`);
    return getFallbackPages();
  }

  console.log(`  Discovered ${unique.length} pages:`);
  unique.forEach((p) => console.log(`    - ${p}`));
  return unique;
}

// Legacy export for backward compatibility
export const discoverAdminPages = discoverPages;
