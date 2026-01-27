import type { Page } from "playwright";
import { fallbackAdminPages } from "./config";

export async function discoverAdminPages(page: Page): Promise<string[]> {
  console.log("  Scanning sidebar/nav for admin links...");

  const links = await page.evaluate(() => {
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
      .filter((path): path is string => path !== null && path.startsWith("/admin"));
  });

  // Deduplicate and remove fragments/query params (already handled by URL parsing)
  const unique = [...new Set(links)].sort();

  if (unique.length === 0) {
    console.log("  No admin links found, using fallback list");
    return fallbackAdminPages;
  }

  console.log(`  Discovered ${unique.length} admin pages:`);
  unique.forEach((p) => console.log(`    - ${p}`));
  return unique;
}
