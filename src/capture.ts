import { chromium, type Page } from "playwright";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import {
  environments,
  viewport,
  screenshotsDir,
  timeouts,
  type EnvConfig,
} from "./config";
import { login } from "./auth";
import { discoverAdminPages } from "./discover";
import type { ProgressManifest } from "./progress";
import {
  isPageCaptured,
  markPageCaptured,
  markEnvironmentComplete,
  isEnvironmentComplete,
  createFreshManifest,
  saveProgress,
} from "./progress";

function pathToFilename(pagePath: string): string {
  return pagePath.replace(/^\//, "").replace(/\//g, "-") + ".png";
}

async function capturePages(
  page: Page,
  pages: string[],
  baseUrl: string,
  outputDir: string,
  manifest: ProgressManifest,
  envName: string
): Promise<void> {
  for (const pagePath of pages) {
    if (isPageCaptured(manifest, envName, pagePath)) {
      console.log(`  Skipping ${pagePath} (already captured)`);
      continue;
    }

    const url = `${baseUrl}${pagePath}`;
    const filename = pathToFilename(pagePath);
    const filepath = path.join(outputDir, filename);

    console.log(`  Capturing ${pagePath}...`);
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: timeouts.pageNavigation,
      });
      // Wait for SPA content to render (sidebar nav links)
      try {
        await page.waitForSelector('a[href*="/admin"]', {
          timeout: timeouts.contentReady,
        });
      } catch {
        // Content may still be loading, take screenshot anyway
      }
      await page.waitForTimeout(timeouts.settleDelay);
      await page.screenshot({ path: filepath, fullPage: true });
      markPageCaptured(manifest, envName, pagePath);
      console.log(`    Saved: ${filepath}`);
    } catch (err) {
      console.error(`    Failed to capture ${pagePath}: ${err}`);
    }
  }
}

export async function captureEnvironment(
  env: EnvConfig,
  manifest: ProgressManifest
): Promise<{ pages: string[]; outputDir: string }> {
  const outputDir = path.join(screenshotsDir, env.name);

  if (isEnvironmentComplete(manifest, env.name)) {
    console.log(`\nSkipping environment: ${env.name} (already complete)`);
    return { pages: manifest.discoveredPages, outputDir };
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  console.log(`\nCapturing environment: ${env.name} (${env.baseUrl})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  try {
    await login(page, env.baseUrl);

    // Reuse already-discovered pages, or discover fresh
    let pages: string[];
    if (manifest.discoveredPages.length > 0) {
      pages = manifest.discoveredPages;
      console.log(`  Using ${pages.length} previously discovered pages`);
    } else {
      pages = await discoverAdminPages(page);
      manifest.discoveredPages = pages;
      saveProgress(manifest);
    }

    await capturePages(page, pages, env.baseUrl, outputDir, manifest, env.name);
    markEnvironmentComplete(manifest, env.name);
    return { pages, outputDir };
  } finally {
    await browser.close();
  }
}

export async function captureAll(
  manifest?: ProgressManifest
): Promise<{ pages: string[]; manifest: ProgressManifest }> {
  const m = manifest ?? createFreshManifest();
  let discoveredPages: string[] = m.discoveredPages;

  for (const env of environments) {
    try {
      const result = await captureEnvironment(env, m);
      if (discoveredPages.length === 0) {
        discoveredPages = result.pages;
      }
    } catch (err) {
      console.error(`\nFailed to capture environment ${env.name}: ${err}`);
      console.error("Continuing to next environment...\n");
    }
  }

  return { pages: discoveredPages, manifest: m };
}

// Allow running standalone
if (import.meta.main) {
  captureAll()
    .then(({ pages }) =>
      console.log(`\nDone! Captured ${pages.length} pages from each environment.`)
    )
    .catch(console.error);
}
